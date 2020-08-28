
import {
  SystemProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

import * as BufferLayout from 'buffer-layout';

import {getOurAccount} from './ourAccount'
import {getNodeConnection} from './nodeConnection'
import {getStore} from './storeConfig'


async function main() {

  const connection = await getNodeConnection()

  const s = await getStore(connection, 'rejectdups.json')

  if ( !s.inStore ) {
    console.log("Deploy program first")
    process.exit(1)
  }

  console.log("-----")

  const accountInfo = await connection.getAccountInfo(s.accountId)
  const data = Buffer.from(accountInfo.data)
  
  const accountDataLayout = BufferLayout.struct([
    BufferLayout.u32('count1'),
    BufferLayout.u32('count2'),
  ]);

  const counts = accountDataLayout.decode(Buffer.from(accountInfo.data))

  console.log("Vote counts, candidate1:", counts.count1, "candidate2:", counts.count2) 

  console.log("-----")
}

main()
  .catch(err => {
    console.error(err)
  })
  .then(() => process.exit())
