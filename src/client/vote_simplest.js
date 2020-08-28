
import {
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

import * as BufferLayout from 'buffer-layout';

import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';

import {getOurAccount} from './ourAccount'
import {getNodeConnection} from './nodeConnection'
import {getStore} from './storeConfig'


async function main() {

  const ourAccount = await getOurAccount()

  const connection = await getNodeConnection()

  const s = await getStore(connection, 'simplest.json')

  if ( !s.inStore ) {
    console.log("Deploy program first")
    process.exit(1)
  }

  let candidate = process.argv[2];

  if ( ! candidate || candidate !== "1" && candidate !== "2" ) {
    console.log("No candidate supplied (should be 1 or 2)");
    process.exit(1);
  }

  candidate = parseInt(candidate,10)

  console.log("-----")

  const instruction_data = Buffer.from([candidate])

  console.log("Voting for candidate:", candidate, "ProgramId:", s.programId.toString(), "AccountId:", s.accountId.toString())

  const balBeforeVote = await connection.getBalance( ourAccount.publicKey )

  const instruction = new TransactionInstruction({
    keys: [{pubkey: s.accountId, isSigner: false, isWritable: true}],
    programId: s.programId,
    data: instruction_data,
  })
  await sendAndConfirmTransaction(
    'vote',
    connection,
    new Transaction().add(instruction),
    ourAccount,
  )

  const balAfterVote = await connection.getBalance( ourAccount.publicKey )

  const costOfVote = balBeforeVote - balAfterVote

  console.log("Cost of voting:",costOfVote,"lamports (", costOfVote/LAMPORTS_PER_SOL, ")")

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
