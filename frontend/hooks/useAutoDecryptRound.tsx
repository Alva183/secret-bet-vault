'use client';

import { useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Address } from 'viem';
import { ethers } from 'ethers';

import { useMetaMaskEthersSigner } from './metamask/useMetaMaskEthersSigner';
import { useFhevm } from '../fhevm/useFhevm';
import { GenericStringInMemoryStorage } from '../fhevm/GenericStringStorage';
import { FhevmDecryptionSignature } from '../fhevm/FhevmDecryptionSignature';
import { VotingGameABI } from '../abi/VotingGameABI';

/**
 * Hook to automatically decrypt a round using the real FHEVM relayer on Sepolia.
 *
 * - On localhost / hardhat (31337): this hook is effectively disabled (isSepolia = false)
 *   and the UI should fall back to the manual modal-based decryption.
 * - On Sepolia (11155111): `autoDecryptRound` will:
 *   1. Read encrypted counters via `getEncryptedCounts(roundId)`
 *   2. Use FHEVM instance + user EIP-712 signature to decrypt them through the relayer
 *   3. Call `setDecryptedResults(roundId, redCount, blueCount)` on-chain.
 */
export function useAutoDecryptRound() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const {
    provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const { instance } = useFhevm({
    provider,
    chainId,
    enabled: true,
    initialMockChains,
  });

  const isSepolia = chainId === 11155111;

  const autoDecryptRound = useCallback(
    async (params: { roundId: number; contractAddress: Address }) => {
      if (!isSepolia) {
        throw new Error('autoDecryptRound is only available on Sepolia');
      }
      if (!publicClient) {
        throw new Error('Public client not ready');
      }
      if (!instance) {
        throw new Error('FHEVM instance not ready');
      }
      if (!ethersSigner || !ethersReadonlyProvider || !address) {
        throw new Error('Wallet not connected');
      }

      const contractAddress = params.contractAddress as `0x${string}`;
      const roundIdBigInt = BigInt(params.roundId);

      // 1. Read encrypted counters from the contract
      const [encRed, encBlue] = (await publicClient.readContract({
        address: contractAddress,
        abi: VotingGameABI,
        functionName: 'getEncryptedCounts',
        args: [roundIdBigInt],
      })) as [string, string];

      if (!encRed || !encBlue) {
        throw new Error('Encrypted counters not available for this round');
      }

      // 2. Prepare / load EIP-712 decryption signature (cached in IndexedDB/localStorage)
      const storage = new GenericStringInMemoryStorage();
      const sig = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [contractAddress],
        ethersSigner,
        storage
      );

      if (!sig) {
        throw new Error('Unable to build FHEVM decryption signature');
      }

      // If chain/signer changed during async work, abort early
      if (
        !sameChain.current(chainId) ||
        !sameSigner.current(ethersSigner)
      ) {
        throw new Error('Stale FHEVM decryption context');
      }

      // 3. Call FHEVM instance.userDecrypt through the relayer
      const handles = [
        { handle: encRed, contractAddress },
        { handle: encBlue, contractAddress },
      ];

      const res = await instance.userDecrypt(
        handles,
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      const redCount = Number(res[encRed] ?? 0);
      const blueCount = Number(res[encBlue] ?? 0);

      // 4. Call setDecryptedResults on the contract using ethers.Signer
      const iface = new ethers.Interface(VotingGameABI);
      const data = iface.encodeFunctionData('setDecryptedResults', [
        roundIdBigInt,
        redCount,
        blueCount,
      ]);

      const tx = await ethersSigner.sendTransaction({
        to: contractAddress,
        data,
      });
      await tx.wait();

      return { redCount, blueCount };
    },
    [
      isSepolia,
      publicClient,
      instance,
      ethersSigner,
      ethersReadonlyProvider,
      address,
      chainId,
      sameChain,
      sameSigner,
    ],
  );

  return { isSepolia, autoDecryptRound };
}


