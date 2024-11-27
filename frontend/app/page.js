"use client";

import { MoralisProvider } from "react-moralis";
import { NotificationProvider } from "web3uikit";

// import ManualHeader from "@/components/ManualHeader";
import Header from "@/components/Header";
import LotteryEntrance from "@/components/LotteryEntrance";

export default function Home() {
    return (
        <div>
            <MoralisProvider initializeOnMount={false}>
                <NotificationProvider>
                    {/* <ManualHeader /> */}
                    <Header />
                    <LotteryEntrance />
                </NotificationProvider>
            </MoralisProvider>
        </div>
    );
}