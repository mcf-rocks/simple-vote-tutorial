
import {
  Account,
} from '@solana/web3.js'
import fs from 'mz/fs'

export async function getOurAccount() {

  const keypairFile = "./keypair.json"

  if( ! fs.existsSync(keypairFile) ) {
    console.log("The expected keypair file",keypairFile,"was not found")
    process.exit(1)
  }

  const secret = JSON.parse( await fs.readFile( keypairFile ))
  const account = new Account( secret )

  console.log('Our account:', account.publicKey.toBase58())

  return account
}
 
