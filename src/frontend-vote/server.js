const https = require('https')
const fs = require('fs')
const express = require('express')
const app = express()
const path = require('path')
const solana = require('@solana/web3.js')
const BufferLayout = require('buffer-layout')

const solanaRPC = 'https://api.mainnet-beta.solana.com'

var connection

app.get('*', async function (request, response, next) {
  console.log('request starting for',request.url)

  // get account balance
	
  if (request.url.startsWith('/accountBalance')) {
    
    const address = request.query.address

    if ( !address ) {
      console.log("No address was passed for balance check")
      return
    }

    const balance = await connection.getBalance( new solana.PublicKey(address) )

    console.log("Account:",address,"Balance:",balance)

    const content = JSON.stringify( { balance } )

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(content, 'utf-8')
 
    return
  }

  // read vote counts
	
  if (request.url.startsWith('/readCount')) {
    
    const address = request.query.contractDataAddress

    if ( !address ) {
      console.log("No address was passed to read vote counts")
      return
    }

    const accountInfo = await connection.getAccountInfo( new solana.PublicKey(address) )
    const data = Buffer.from(accountInfo.data)

    const accountDataLayout = BufferLayout.struct([
      BufferLayout.u32('vc1'),
      BufferLayout.u32('vc2'),
    ])

    const counts = accountDataLayout.decode(Buffer.from(accountInfo.data))

    console.log("Vote Count: 1)",counts.vc1,"2)",counts.vc2)

    const content = JSON.stringify( { vc1: counts.vc1, vc2: counts.vc2 } )

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(content, 'utf-8')
 
    return
  }

  // get recent blockhash
	
  if (request.url.startsWith('/recentBlockhash')) {
    
    const { blockhash } = await connection.getRecentBlockhash('max')

    console.log("Recent Blockhash:", blockhash)

    const content = JSON.stringify( { blockhash } )

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(content, 'utf-8')
 
    return
  }

  // voter status 
	
  if (request.url.startsWith('/voterStatus')) {
    
    const address = request.query.voterCheckAddress

    if ( !address ) {
      console.log("No address was passed to check voter")
      return
    }

    const accountInfo = await connection.getAccountInfo( new solana.PublicKey(address) )

    let voted

    if ( !accountInfo ) {
      console.log("Voted: Never")
      voted = 99
    } else {

      const data = Buffer.from(accountInfo.data)

      const accountDataLayout = BufferLayout.struct([
        BufferLayout.u32('voted'),
      ])

      voted = accountDataLayout.decode(Buffer.from(accountInfo.data)).voted
      console.log("Voted: ",voted)
    }

    const content = JSON.stringify( { voted } )

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(content, 'utf-8')
 
    return
  }

  // vote cost
	
  if (request.url.startsWith('/voteCost')) {

    const rent = await connection.getMinimumBalanceForRentExemption(4)
    const voteCost = 2 * 5000 // the two signatures
    const cost = rent + voteCost

    console.log("Total Cost:", cost, "of which", rent, "is the rent exemption")

    const content = JSON.stringify( { cost, rent } )

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(content, 'utf-8')
 
    return
  }

  // submit transaction - expects JSON encoded serialized bytes
	
  if (request.url.startsWith('/submitTransaction')) {
    
    const transactionJSON = request.query.transaction

    if ( !transactionJSON ) {
      console.log("No transaction was passed")
      return
    }

    const bytes = JSON.parse( transactionJSON )

    console.log("Transaction:", bytes)

    const start = Date.now();

    let tSig

    try {
      tSig = await connection.sendRawTransaction( bytes, { skipPreflight: true } )
    } catch(err) {
      console.log("Send FAILED:",err)
      const content = JSON.stringify( { err: 'Transaction rejected' } )
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(content, 'utf-8')
      return
    }

    console.log("Transaction Signature:", tSig)

    const tStatus = (
      await connection.confirmTransaction(
        tSig,
        { confirmations: 1 },
      )
    ).value

    if (tStatus) {
      if (tStatus.err) {
        console.log(`Transaction ${tSig} failed (${JSON.stringify(tStatus)})`)
      }
      const content = JSON.stringify( tStatus )
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(content, 'utf-8')
      return
    }
 
    const duration = (Date.now() - start) / 1000;
    console.log(`Transaction was not confirmed in ${duration.toFixed( 2,)} seconds (${JSON.stringify(tStatus)})`)
    const content = JSON.stringify( tStatus )
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(content, 'utf-8')
    return

  }



  // serve a file
	
  var filePath = '.' + request.url

  if (filePath === './') filePath = './index.html'

  var extname = path.extname(filePath)
  var contentType = 'text/html;charset=utf-8'
  switch (extname) {
    case '.js':
      contentType = 'text/javascript'
      break
    case '.css':
      contentType = 'text/css'
      break
    case '.json':
      contentType = 'application/json'
      break
    case '.png':
      contentType = 'image/png'
    break;      
      case '.jpg':
      contentType = 'image/jpg'
    break
      case '.wav':
      contentType = 'audio/wav'
    break
    }

    fs.readFile(filePath, function(error, content) {
      if (error) {
        if(error.code == 'ENOENT'){
          fs.readFile('./404.html', function(error, content) {
            response.writeHead(200, { 'Content-Type': contentType })
            response.end(content, 'utf-8')
          })
        }
        else {
          response.writeHead(500)
          response.end('Sorry, check with the site admin for error: '+error.code+' ..\n')
          response.end(); 
        }
      }
      else {
        response.writeHead(200, { 'Content-Type': contentType })
        response.end(content, 'utf-8')
      }
  })
})

async function getNodeConnection(url) {
  connection = new solana.Connection(url, 'recent')
  const version = await connection.getVersion()
  console.log('Connection to cluster established:', url, version)
}

getNodeConnection( solanaRPC ).then( function() { 

  const credentials = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  }

  var httpsServer = https.createServer(credentials, app)

  httpsServer.listen(443)

  var ip = require("ip")
  console.dir ( "waiting for you on https://"+ip.address()+":443" )

})
