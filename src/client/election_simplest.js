
import {
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

import * as BufferLayout from 'buffer-layout';

import {onTransaction, sendAndConfirmTransactionCatch} from './util/send-and-confirm-transaction-catch';

import {getOurAccount} from './ourAccount'
import {getNodeConnection} from './nodeConnection'
import {getStore} from './storeConfig'

const COST_OF_VOTE = 5000

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

async function main() {

  const ourAccount = await getOurAccount()

  const connection = await getNodeConnection()

  const s = await getStore(connection, 'simplest.json')

  if ( !s.inStore ) {
    console.log("Deploy program first")
    process.exit(1)
  }

  let numVotes = process.argv[2];

  if ( ! numVotes ) {
    console.log("Specify number of voters");
    process.exit(1);
  }

  console.log("-----")

  numVotes = parseInt(numVotes,10)

  console.log("About to cast", numVotes, "votes")

  const balBeforeElection = await connection.getBalance( ourAccount.publicKey )

  if ( balBeforeElection < COST_OF_VOTE * numVotes ) {
    console.log("You don't have the funds for this!");
    process.exit(1)
  }

/**
  // call back when transaction is mined
  onTransaction( function( title, body ) {
      console.log(title,body)
  })
**/

  let voteInstructions = []

  let cast = [0,0,0]

  for (let n=0; n<numVotes; n++) {

    const candidate = getRandomInt(2)+1

    const instruction_data = Buffer.from([candidate])

    cast[0]++
    cast[candidate]++

    voteInstructions[n] = new TransactionInstruction({
      keys: [{pubkey: s.accountId, isSigner: false, isWritable: true}],
      programId: s.programId,
      data: instruction_data,
    })
  }

  console.log(cast[0], "casting votes:", cast[1], "for candidate1 and", cast[2], "for candidate2")


  // We submit all transactions in one go, whatever fails we retry, until they complete or retry max reached

  let retry = 10;

  while ( voteInstructions.length > 0 && retry > 0 ) {

    console.log("Submitting",voteInstructions.length,"transactions")

    let voteTransactions = []

    for (let n=0; n<voteInstructions.length; n++) {
      voteTransactions[n] = sendAndConfirmTransactionCatch(
        'vote',
        connection,
        new Transaction().add(voteInstructions[n]),
        ourAccount,
      )
    }

    // wait for all the transactions to fail or complete

    console.log("Waiting for batch to complete or fail")

    let resolved = await Promise.all(voteTransactions)

    let failed = 0
    let complete = 0

    let retryInstructions = []

    for (let n=0; n<resolved.length; n++) {
      const tStatus = resolved[n]
      if ( tStatus.isError ) {
        //console.log("Tran", n, "failed with:", tStatus.error.toString())
        failed++
        retryInstructions.push( voteInstructions[n] )        
      } else {
        const transactionReceipt = tStatus.transactionReceipt
        //console.log("Tran", n, "with signature", transactionReceipt.signature, "mined at", transactionReceipt.confirmedDate)     
        complete++
      }
    }
    console.log("Completed:",complete,"Failed:",failed)
 
    voteInstructions = retryInstructions

    retry--

    if ( 0===retry ) {
      console.log("Retry limit exceeded")
    }
  }

  const balAfterElection = await connection.getBalance( ourAccount.publicKey )

  const costOfElection = balBeforeElection - balAfterElection

  console.log("Cost of election:",costOfElection,"lamports (", costOfElection/LAMPORTS_PER_SOL, ")")

  const accountInfo = await connection.getAccountInfo(s.accountId)

  if ( accountInfo === null ) {
    console.log("The account",s.accountId,"was not found")
    process.exit(1)
  }

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
