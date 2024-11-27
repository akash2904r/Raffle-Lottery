import { ConnectButton } from "web3uikit";

export default function Header() {
    return (
        <div className="p-3 border-b-2 border-[#363636] flex items-center">
            <h1 className="p-4 font-bold text-3xl text-[#6689bf]">Raffle Lottery</h1>
            <div className="ml-auto py-2 px-4">
                <ConnectButton moralisAuth={false} className="bg-black" />
            </div>
        </div>
    );
}