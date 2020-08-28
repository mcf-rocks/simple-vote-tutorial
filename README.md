<p align="center">
  <a href="https://mcf.rocks">
  </a>
</p>

# Simple Smart Contract Tutorial for Solana Blockchain

This is the code for a tutorial, which explains step-by-step how to write, deploy, and interact with a smart contract on the Solana Blockchain. It intentionally translates an existing (and quite famous) tutorial for Ethereum, aiming at exact functional compatibility. The tutorial works from the simple to the complex, and therefore includes multiple versions of the program and front-end, the final version is a web page interacting with the contract back-end on the Solana Mainnet.

## Quick Start

The following dependencies are required to build and run this example,
depending on your OS, they may already be installed:

```bash
$ node --version
$ npm --version
$ docker -v
$ wget --version
$ rustup --version
$ rustc --version
$ cargo --version
```

If this is your first time using Docker or Rust, these [Installation Notes](README-installation-notes.md) might be helpful.

[Solana documentation](https://docs.solana.com/)

This code is designed to be used with the [Tutorial](https://medium.com/@smith_10562/a-simple-solana-dapp-tutorial-6dedbdf65444)

But if you just want to 'make it do something':

Clone this github

```
cd simple-vote-tutorial
npm install
npm run cluster_devnet
npm run keypair
npm run airdrop
npm run build_simplest
npm run deploy_simplest
npm run vote_simplest -- 2
```

You just voted via a smart contract on Solana (devnet).

## About Solana

More information about how Solana works is available in the [Solana documentation](https://docs.solana.com/) and all the source code is available on [github](https://github.com/solana-labs/solana)

Further questions?  Visit us on [Discord](https://discordapp.com/invite/pquxPsq)

- [Solana web3.js SDK](https://github.com/solana-labs/solana-web3.js)
- [Solana web3 API](https://solana-labs.github.io/solana-web3.js)

