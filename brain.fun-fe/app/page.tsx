"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Program } from '@project-serum/anchor';
import { WalletMultiButton, WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import * as anchor from '@project-serum/anchor';
import {
  ConnectionProvider,
  WalletProvider,

} from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  PhantomWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import idl from "./idl.json"



// プログラムIDとIDLの設定（IDLはプログラムのコンパイル時に生成されます）
const programId = new
  PublicKey('Aoquk2SUkbeqcQxYoCok9wb9PPZgQxCQdDVF2SSb7MQD');
const globalStateId = new PublicKey("9YNfm5yj5hscWSLZmeE8MoJ3VNTWXiCF1odxrY2wy1Cv");


const WalletContextProvider = ({ children }: { children: React.ReactNode }) => {
  const endpoint = useMemo(() => 'https://api.devnet.solana.com', []);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider >
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const createProvider = (wallet: AnchorWallet, connection: Connection) => {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  return provider;
}

const createUser = async (
  wallet: AnchorWallet,
  connection: Connection
) => {
  const provider = createProvider(wallet, connection);
  const program = new Program(idl, programId, provider);

  // PDAを算出
  const [userStateId] = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBytes()],
    program.programId
  );
  console.log("userStateId", userStateId.toString());

  console.log({
    owner: wallet.publicKey,
    userState: userStateId,
    globalState: globalStateId,
    systemProgram: anchor.web3.SystemProgram.programId,
  })

  return await program.methods
    .createUser()
    .accounts({
      owner: wallet.publicKey,
      userState: userStateId,
      globalState: globalStateId,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
}

const play = async (
  wallet: AnchorWallet,
  connection: Connection
) => {
  const provider = createProvider(wallet, connection);
  const program = new Program(idl, programId, provider);

  // PDAを算出
  const [userStateId] = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBytes()],
    program.programId
  );
  console.log("userState", userStateId.toString());

  return await program.methods
    .play()
    .accounts({
      player: wallet.publicKey,
      userState: userStateId,
      globalState: globalStateId,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
}


const SlotMachine = () => {
  const [result, setResult] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);

  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // トランザクションの確認
  // await program.provider.connection.confirmTransaction(tx);

  // 結果の取得（この部分はプログラムの実装に依存します）
  // 例: イベントをリッスンするか、状態を直接読み取る
  // if (provider) {
  //   const userState = await program.account.userState.fetch(provider.wallet.publicKey);
  // }
  // const gameResult = userState.lastResult; // lastResult フィールドが存在すると仮定

  // // 結果の解釈
  // const resultMap = {
  //   0: 'Grape',
  //   1: 'Cherry',
  //   2: 'Replay',
  //   3: 'BIG',
  //   4: 'REG',
  //   5: 'None'
  // };

  // setResult(resultMap[gameResult] || 'Unknown');

  const handleCreateUser = async () => {
    if (!wallet) {
      console.error('ウォレットが接続されていません。');
      return;
    }
    createUser(wallet, connection);
  }

  const handlePlay = async () => {
    if (!wallet) {
      console.error('ウォレットが接続されていません。');
      return;
    }
    setIsSpinning(true);
    await play(wallet, connection);
    setIsSpinning(false);
  }


  return (
    <div className={'bg-gray-800'}>
      <div
        className={
          'flex justify-end pt-8 pr-8'
        }
      >
        <WalletMultiButton />
      </div>
      <div className="flex flex-col items-center justify-center h-screen">

        <motion.div
          className="text-6xl font-bold mb-8 text-white"
          animate={{
            y: isSpinning ? [0, -20, 20, -20, 20, 0] : 0,
            rotate: isSpinning ? [0, -10, 10, -10, 10, 0] : 0
          }}
          transition={{ duration: 0.5, repeat: isSpinning ? Infinity : 0 }}
        >
          {isSpinning ? '?' : result || '?'}
        </motion.div>
        <button
          className="px-6 py-3 bg-yellow-500 text-white rounded-full font-bold text-xl hover:bg-yellow-600 transition-colors w-40 mb-2"
          onClick={handleCreateUser}>
          {"ユーザ作成"}
        </button>
        <button
          className="px-6 py-3 bg-yellow-500 text-white rounded-full font-bold text-xl hover:bg-yellow-600 transition-colors w-40"
          onClick={handlePlay}
          disabled={isSpinning}
        >
          {isSpinning ? 'スピン中...' : 'スピン！'}
        </button>
      </div>
    </div>
  );
};




const App = () => {
  return (
    <WalletContextProvider>
      <SlotMachine />
    </WalletContextProvider>
  );
};

export default App;