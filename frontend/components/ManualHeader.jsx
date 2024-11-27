import { useEffect } from "react";
import { useMoralis } from "react-moralis";

export default function ManualHeader() {
    const { 
        enableWeb3, account, isWeb3Enabled, 
        Moralis, deactivateWeb3, isWeb3EnableLoading 
    } = useMoralis();

    useEffect(() => {
        // In case connected to wallet and browser is reloaded, it makes sure that the wallet stays connected
        if (
            !isWeb3Enabled && typeof window !== "undefined" && 
            window.localStorage.getItem("connected")
        ) {
            enableWeb3();
        }
    }, [isWeb3Enabled])

    useEffect(() => {
        Moralis.onAccountChanged((newAccount) => {
            console.log(`Account changed to: ${newAccount}`);
            // Remove the locally set connected variable if disconnected from the wallet
            if (newAccount === null) {
                window.localStorage.removeItem("connected");
                // Sets the isWeb3Enabled variable to false
                deactivateWeb3();
            }
        })
    }, [])

    return (
        <div>
            {account ? (
                <div>Connected to: {account.slice(0, 6)}...{account.slice(-4)}</div>
            ) : (
                <button 
                    onClick={async () => {
                        const res = await enableWeb3();
                        // Locally setting a connected variable if connected to an wallet
                        if (!res && typeof window !== "undefined") {
                            window.localStorage.setItem("connected", "injected");
                        }
                    }}
                    disabled={isWeb3EnableLoading}
                >Connect</button>
            )}
        </div>
    );
}