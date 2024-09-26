"use client"; 
import Image from "next/image";

import React, { useState, useEffect , useMemo} from 'react';
import { motion } from 'framer-motion';
import * as web3 from '@solana/web3.js';
import { Program, AnchorProvider, web3 as anchorWeb3, Wallet } from '@project-serum/anchor';
import { WalletMultiButton, WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import * as anchor from '@project-serum/anchor';
import { 
  ConnectionProvider, 
  WalletProvider ,
  
} from '@solana/wallet-adapter-react';
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { useAnchorWallet,useConnection ,useWallet} from '@solana/wallet-adapter-react';

// プログラムIDとIDLの設定（IDLはプログラムのコンパイル時に生成されます）
const programId = new web3.PublicKey('Aoquk2SUkbeqcQxYoCok9wb9PPZgQxCQdDVF2SSb7MQD');
const idl = JSON.parse('{"version":"0.1.0","name":"solana_slot_program","instructions":[{"name":"initialize","accounts":[{"name":"globalState","isMut":true,"isSigner":true},{"name":"owner","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"updateProbabilities","accounts":[{"name":"globalState","isMut":true,"isSigner":false},{"name":"owner","isMut":false,"isSigner":true}],"args":[{"name":"newProbabilities","type":{"array":["u32",6]}}]},{"name":"updatePlayCost","accounts":[{"name":"globalState","isMut":true,"isSigner":false},{"name":"owner","isMut":false,"isSigner":true}],"args":[{"name":"newCost","type":"u64"}]},{"name":"createUser","accounts":[{"name":"userState","isMut":true,"isSigner":true},{"name":"owner","isMut":true,"isSigner":true},{"name":"globalState","isMut":false,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"play","accounts":[{"name":"userState","isMut":true,"isSigner":false},{"name":"player","isMut":true,"isSigner":true},{"name":"globalState","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]}],"accounts":[{"name":"GlobalState","type":{"kind":"struct","fields":[{"name":"owner","type":"publicKey"},{"name":"settingProbabilities","type":{"array":["u32",6]}},{"name":"playCost","type":"u64"}]}},{"name":"UserState","type":{"kind":"struct","fields":[{"name":"owner","type":"publicKey"},{"name":"setting","type":"u8"},{"name":"playCount","type":"u32"}]}}],"errors":[{"code":6000,"name":"Unauthorized","msg":"Unauthorized"},{"code":6001,"name":"InvalidProbabilities","msg":"Invalid probabilities"},{"code":6002,"name":"MaxPlaysReached","msg":"Max plays reached"}]}');

const WalletContextProvider = ({ children }) => {
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

const SlotMachine = () => {
  const [result, setResult] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [provider, setProvider] = useState(null);
  const [program, setProgram] = useState(null);
  
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { publicKey } = useWallet();

  useEffect(() => {
    const initializeProgram = async () => {
      if (anchorWallet) {
        const provider = new anchor.AnchorProvider(connection, anchorWallet, {
          preflightCommitment: 'processed',
        });
        const program = new anchor.Program(idl, programId, provider);
        setProgram(program);
      }
    };

    initializeProgram();
  }, [connection, anchorWallet]);

  const spinSlot = async () => {
    if (!program) {
      console.error('プログラムが初期化されていません。');
      return;
    }

    setIsSpinning(true);

    try {
      // play 関数の呼び出し
      const tx = await program.rpc.play();
      console.log('Transaction signature', tx);

      // トランザクションの確認
      await program.provider.connection.confirmTransaction(tx);

      // 結果の取得（この部分はプログラムの実装に依存します）
      // 例: イベントをリッスンするか、状態を直接読み取る
      if (provider) {
        const userState = await program.account.userState.fetch(provider.wallet.publicKey);
      }
      const gameResult = userState.lastResult; // lastResult フィールドが存在すると仮定

      // 結果の解釈
      const resultMap = {
        0: 'Grape',
        1: 'Cherry',
        2: 'Replay',
        3: 'BIG',
        4: 'REG',
        5: 'None'
      };

      setResult(resultMap[gameResult] || 'Unknown');
    } catch (error) {
      console.error('Error during play:', error);
      setResult('Error');
    } finally {
      setIsSpinning(false);
    }
  };

  return (
    
    <div className="flex flex-col items-center justify-center h-screen bg-gray-800">
       <WalletMultiButton className="mb-4" />
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
        className="px-6 py-3 bg-yellow-500 text-white rounded-full font-bold text-xl hover:bg-yellow-600 transition-colors"
        onClick={spinSlot}
        disabled={isSpinning || !program}
      >
        {isSpinning ? 'スピン中...' : 'スピン！'}
      </button>
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