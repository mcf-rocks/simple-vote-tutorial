// @flow

import {sendAndConfirmTransaction as realSendAndConfirmTransaction} from '@solana/web3.js'
import type {Account, Connection, Transaction} from '@solana/web3.js'
import YAML from 'json-to-pretty-yaml'

type TransactionNotification = (string, string) => void

let notify: TransactionNotification = () => undefined

export function onTransaction(callback: TransactionNotification) {
  notify = callback
}

// SMITH: like the official one, but the promise resolves to either
//        the transaction details
//        or the error

export async function sendAndConfirmTransactionCatch(
  title: string,
  connection: Connection,
  transaction: Transaction,
  ...signers: Array<Account>
): Promise<void> {
  const submittedDate = new Date()

  let signature

  try {

    signature = await realSendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        confirmations: 1,
        skipPreflight: true,
      },
    )
  } catch (e) {
    return { isError: true, error: e }
  }

  const confirmedDate = new Date()
  
  const body = {
    submittedDate: submittedDate.toUTCString(),
    confirmedDate: confirmedDate.toUTCString(),
    signature,
    instructions: transaction.instructions.map(i => {
      return {
        keys: i.keys.map(keyObj => keyObj.pubkey.toBase58()),
        programId: i.programId.toBase58(),
        data: '0x' + i.data.toString('hex'),
      }
    }),
  }

  notify(title, YAML.stringify(body).replace(/"/g, ''))

  return { isError: false, transactionReceipt: body }
}
