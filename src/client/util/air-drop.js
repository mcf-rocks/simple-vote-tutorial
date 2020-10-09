// @flow

import {Account, Connection} from '@solana/web3.js'

import {sleep} from './sleep'

export async function airDrop(
  account: Account,
  connection: Connection,
  lamports: number = 10000000000,   // current max on devnet is 10 Sol, might change in the future, adjust accordingly
): Promise<Account> {

  const initial = await connection.getBalance(account.publicKey)
  const expected = initial + lamports

  let retries = 10
  await connection.requestAirdrop(account.publicKey, lamports)
  for (;;) {
    await sleep(500)
    if (expected === (await connection.getBalance(account.publicKey))) {
      return account
    }
    if (--retries <= 0) {
      break
    }
    console.log('Airdrop retry ' + retries)
  }
  throw new Error(`Airdrop of ${lamports} failed`)
}
