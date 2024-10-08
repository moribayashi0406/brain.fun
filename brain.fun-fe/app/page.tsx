"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import idl from "./idl.json";




// プログラムIDとIDLの設定（IDLはプログラムのコンパイル時に生成されます）
const programId = new
  PublicKey('EYBneqf153nZjsqXg9bv1oJMa3vq7opDcGqxELBVyfqd');
const globalStateId = new PublicKey("HKqzzmSMidmofFk6nHpV54ajFNALSnCTWp5Lwf6bCoN4");


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

const getUserState = async (wallet: AnchorWallet,
  connection: Connection) => {
  const provider = createProvider(wallet, connection);
  const program = new Program(idl as anchor.Idl, programId, provider);
  // PDAを算出
  const [userStateId] = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBytes()],
    program.programId
  );
  try {
    const userState = await program.account.userState.fetch(userStateId);
    return userState;
  }
  catch (e) {
    return null;
  }

}

const createUser = async (
  wallet: AnchorWallet,
  connection: Connection
) => {
  const provider = createProvider(wallet, connection);
  const program = new Program(idl as anchor.Idl, programId, provider);

  // PDAを算出
  const [userStateId] = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBytes()],
    program.programId
  );
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
  const program = new Program(idl as anchor.Idl, programId, provider);

  // PDAを算出
  const [userStateId] = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBytes()],
    program.programId
  );
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



const getResult = async (connection: Connection, tx: string) => {
  const resultTx = await connection.getTransaction(tx, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  const result = resultTx?.meta?.logMessages?.[8]?.split(": ").pop();
  return result;
}


const SlotMachine = () => {
  const [result, setResult] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [userState, setUserState] = useState<any>(null);
  const [isJackpot, setIsJackpot] = useState(false);


  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [colorIndex, setColorIndex] = useState(0);
  const audioRef = useRef(null);


  const flashingColors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500'
  ];

  const audio = new Audio("/kyuin.mp3");


  useEffect(() => {
    if (isJackpot) {
      const interval = setInterval(() => {
        setColorIndex((prevIndex) => (prevIndex + 1) % flashingColors.length);
      }, 100); // 100ミリ秒ごとに色を変更

      return () => clearInterval(interval);
    } else {
      setColorIndex(4);
    }
  }, [flashingColors.length, isJackpot]);


  useEffect(() => {
    const func = async () => {
      if (!wallet) {
        return;
      }
      const userStateRes = await getUserState(wallet, connection);
      setUserState(userStateRes);
    }
    func();
  }, [wallet, connection]);



  const handleCreateUser = async () => {
    if (!wallet) {
      console.error('ウォレットが接続されていません。');
      return;
    }
    setIsCreating(true);
    const tx = createUser(wallet, connection);
    console.log(tx);
    for (let i = 0; i < 100; i++) {
      const result = await getUserState(wallet, connection);
      if (result) {
        setUserState(result);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setIsCreating(false);
  }

  const handlePlay = async () => {
    if (!wallet) {
      console.error('ウォレットが接続されていません。');
      return;
    }
    setIsSpinning(true);
    const tx = await play(wallet, connection);
    console.log(tx);
    for (let i = 0; i < 100; i++) {
      const result = await getResult(connection, tx);
      if (result) {
        setResult(result);
        if (result != "None" && result != "Replay") {
          setIsJackpot(true);
          audio.currentTime = 0;
          audio.play();
          setTimeout(() => {
            setIsJackpot(false);
            audio.pause();
          }, 5000);
        }
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setIsSpinning(false);
  }




  return (
    <div className={`w-full h-full absolute ${isJackpot ? flashingColors[colorIndex] : 'bg-gray-800'} transition-colors duration-100`}>
      <audio ref={audioRef} src="./kyuin.mp3" />
      <div
        className={
          'flex justify-end pt-8 pr-8'
        }
      >
        <WalletMultiButton />
      </div>
      <div className="flex flex-col items-center justify-center h-screen">
        <div className={isJackpot ? "animate-bounce" : ""}>
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
        </div>
        {userState ?
          <button suppressHydrationWarning
            className="px-6 py-3 bg-yellow-500 text-white rounded-full font-bold text-xl hover:bg-yellow-600 transition-colors w-56"
            onClick={handlePlay}
            disabled={isSpinning}
          ><p>{isSpinning ? 'Spinning...' : 'Spin！'}</p >
          </button> :
          <button suppressHydrationWarning
            className="px-6 py-3 bg-yellow-500 text-white rounded-full font-bold text-xl hover:bg-yellow-600 transition-colors w-56 mb-2"
            onClick={handleCreateUser}>
            <p>{isCreating ? "Creating..." : "Create Account"}</p >
          </button>}
      </div>
    </div >
  );
};




const App = () => {
  return (

    <WalletContextProvider >
      <SlotMachine />
    </WalletContextProvider>

  );
};

export default App;