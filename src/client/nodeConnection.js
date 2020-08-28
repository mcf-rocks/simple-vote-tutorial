
import {
  Connection,
} from '@solana/web3.js'
import fs from 'mz/fs'

import dotenv from 'dotenv'

dotenv.config()

let url

switch ( process.env.CLUSTER ) {

  case 'mainnet-beta':
    console.log('attempting to connect to mainnet')
    url = 'http://34.64.164.198:8899'
    break;

  case 'testnet':
    console.log('attempting to connect to testnet')
    url = 'http://testnet.solana.com:8899'
    break;

  case 'testnet4XW':
    console.log('attempting to connect to testnet 4XW node -- my own node')
    url = 'http://91.193.116.35:8899'
    break;

  case 'devnet':
    console.log('attempting to connect to devnet')
    url = 'http://34.82.57.86:8899'
    break;

  default:
    console.log('attempting to connect to local node')
    url = 'http://localhost:8899'
}


export async function getNodeConnection() {
  const connection = new Connection(url, 'recent')
  const version = await connection.getVersion()
  console.log('Connection to cluster established:', url, version)
  return connection
}

 
