import _classCallCheck from '@babel/runtime/helpers/classCallCheck';
import _createClass from '@babel/runtime/helpers/createClass';
import _defineProperty from '@babel/runtime/helpers/defineProperty';
import nacl from 'tweetnacl';
import _regeneratorRuntime from '@babel/runtime/regenerator';
import _asyncToGenerator from '@babel/runtime/helpers/asyncToGenerator';
import BN from 'bn.js';
import bs58 from 'bs58';
import { sha256 } from 'crypto-hash';
import { blob, struct, ns64, u32, offset, u8, seq, nu64 } from 'buffer-layout';
import _toConsumableArray from '@babel/runtime/helpers/toConsumableArray';
import assert from 'assert';
import { parse, format } from 'url';
import fetch from 'node-fetch';
import jayson from 'jayson/lib/client/browser';
import { struct as struct$1 } from 'superstruct';
import { Client } from 'rpc-websockets';

var toBuffer = function toBuffer(arr) {
  if (arr instanceof Buffer) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  } else {
    return Buffer.from(arr);
  }
};

var naclLowLevel = nacl.lowlevel;
// This type exists to workaround an esdoc parse error

/**
 * A public key
 */
var PublicKey = /*#__PURE__*/function () {
  /**
   * Create a new PublicKey object
   */
  function PublicKey(value) {
    _classCallCheck(this, PublicKey);

    _defineProperty(this, "_bn", void 0);

    if (typeof value === 'string') {
      // assume base 58 encoding by default
      var decoded = bs58.decode(value);

      if (decoded.length != 32) {
        throw new Error("Invalid public key input");
      }

      this._bn = new BN(decoded);
    } else {
      this._bn = new BN(value);
    }

    if (this._bn.byteLength() > 32) {
      throw new Error("Invalid public key input");
    }
  }
  /**
   * Checks if two publicKeys are equal
   */


  _createClass(PublicKey, [{
    key: "equals",
    value: function equals(publicKey) {
      return this._bn.eq(publicKey._bn);
    }
    /**
     * Return the base-58 representation of the public key
     */

  }, {
    key: "toBase58",
    value: function toBase58() {
      return bs58.encode(this.toBuffer());
    }
    /**
     * Return the Buffer representation of the public key
     */

  }, {
    key: "toBuffer",
    value: function toBuffer() {
      var b = this._bn.toArrayLike(Buffer);

      if (b.length === 32) {
        return b;
      }

      var zeroPad = Buffer.alloc(32);
      b.copy(zeroPad, 32 - b.length);
      return zeroPad;
    }
    /**
     * Returns a string representation of the public key
     */

  }, {
    key: "toString",
    value: function toString() {
      return this.toBase58();
    }
    /**
     * Derive a public key from another key, a seed, and a program ID.
     */

  }], [{
    key: "createWithSeed",
    value: function () {
      var _createWithSeed = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(fromPublicKey, seed, programId) {
        var buffer, hash;
        return _regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                buffer = Buffer.concat([fromPublicKey.toBuffer(), Buffer.from(seed), programId.toBuffer()]);
                _context.next = 3;
                return sha256(new Uint8Array(buffer));

              case 3:
                hash = _context.sent;
                return _context.abrupt("return", new PublicKey(Buffer.from(hash, 'hex')));

              case 5:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      function createWithSeed(_x, _x2, _x3) {
        return _createWithSeed.apply(this, arguments);
      }

      return createWithSeed;
    }()
    /**
     * Derive a program address from seeds and a program ID.
     */

  }, {
    key: "createProgramAddress",
    value: function () {
      var _createProgramAddress = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee2(seeds, programId) {
        var buffer, hash, publicKeyBytes;
        return _regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                buffer = Buffer.alloc(0);
                seeds.forEach(function (seed) {
                  buffer = Buffer.concat([buffer, Buffer.from(seed)]);
                });
                buffer = Buffer.concat([buffer, programId.toBuffer(), Buffer.from('ProgramDerivedAddress')]);
                _context2.next = 5;
                return sha256(new Uint8Array(buffer));

              case 5:
                hash = _context2.sent;
                publicKeyBytes = new BN(hash, 16).toArray();

                if (!is_on_curve(publicKeyBytes)) {
                  _context2.next = 9;
                  break;
                }

                throw new Error("Invalid seeds, address must fall off the curve");

              case 9:
                return _context2.abrupt("return", new PublicKey(publicKeyBytes));

              case 10:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }));

      function createProgramAddress(_x4, _x5) {
        return _createProgramAddress.apply(this, arguments);
      }

      return createProgramAddress;
    }()
    /**
     * Find a valid program address
     *
     * Valid program addresses must fall off the ed25519 curve.  This function
     * iterates a nonce until it finds one that when combined with the seeds
     * results in a valid program address.
     */

  }, {
    key: "findProgramAddress",
    value: function () {
      var _findProgramAddress = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee3(seeds, programId) {
        var nonce, address, seedsWithNonce;
        return _regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                nonce = 255;

              case 1:
                if (!(nonce != 0)) {
                  _context3.next = 16;
                  break;
                }

                _context3.prev = 2;
                seedsWithNonce = seeds.concat(Buffer.from([nonce]));
                _context3.next = 6;
                return this.createProgramAddress(seedsWithNonce, programId);

              case 6:
                address = _context3.sent;
                _context3.next = 13;
                break;

              case 9:
                _context3.prev = 9;
                _context3.t0 = _context3["catch"](2);
                nonce--;
                return _context3.abrupt("continue", 1);

              case 13:
                return _context3.abrupt("return", [address, nonce]);

              case 16:
                throw new Error("Unable to find a viable program address nonce");

              case 17:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this, [[2, 9]]);
      }));

      function findProgramAddress(_x6, _x7) {
        return _findProgramAddress.apply(this, arguments);
      }

      return findProgramAddress;
    }()
  }]);

  return PublicKey;
}(); // Check that a pubkey is on the curve.
// This function and its dependents were sourced from:
// https://github.com/dchest/tweetnacl-js/blob/f1ec050ceae0861f34280e62498b1d3ed9c350c6/nacl.js#L792

function is_on_curve(p) {
  var r = [naclLowLevel.gf(), naclLowLevel.gf(), naclLowLevel.gf(), naclLowLevel.gf()];
  var t = naclLowLevel.gf(),
      chk = naclLowLevel.gf(),
      num = naclLowLevel.gf(),
      den = naclLowLevel.gf(),
      den2 = naclLowLevel.gf(),
      den4 = naclLowLevel.gf(),
      den6 = naclLowLevel.gf();
  naclLowLevel.set25519(r[2], gf1);
  naclLowLevel.unpack25519(r[1], p);
  naclLowLevel.S(num, r[1]);
  naclLowLevel.M(den, num, naclLowLevel.D);
  naclLowLevel.Z(num, num, r[2]);
  naclLowLevel.A(den, r[2], den);
  naclLowLevel.S(den2, den);
  naclLowLevel.S(den4, den2);
  naclLowLevel.M(den6, den4, den2);
  naclLowLevel.M(t, den6, num);
  naclLowLevel.M(t, t, den);
  naclLowLevel.pow2523(t, t);
  naclLowLevel.M(t, t, num);
  naclLowLevel.M(t, t, den);
  naclLowLevel.M(t, t, den);
  naclLowLevel.M(r[0], t, den);
  naclLowLevel.S(chk, r[0]);
  naclLowLevel.M(chk, chk, den);
  if (neq25519(chk, num)) naclLowLevel.M(r[0], r[0], I);
  naclLowLevel.S(chk, r[0]);
  naclLowLevel.M(chk, chk, den);
  if (neq25519(chk, num)) return 0;
  return 1;
}

var gf1 = naclLowLevel.gf([1]);
var I = naclLowLevel.gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

function neq25519(a, b) {
  var c = new Uint8Array(32),
      d = new Uint8Array(32);
  naclLowLevel.pack25519(c, a);
  naclLowLevel.pack25519(d, b);
  return naclLowLevel.crypto_verify_32(c, 0, d, 0);
}

/**
 * An account key pair (public and secret keys).
 */

var Account = /*#__PURE__*/function () {
  /**
   * Create a new Account object
   *
   * If the secretKey parameter is not provided a new key pair is randomly
   * created for the account
   *
   * @param secretKey Secret key for the account
   */
  function Account(secretKey) {
    _classCallCheck(this, Account);

    _defineProperty(this, "_keypair", void 0);

    if (secretKey) {
      this._keypair = nacl.sign.keyPair.fromSecretKey(toBuffer(secretKey));
    } else {
      this._keypair = nacl.sign.keyPair();
    }
  }
  /**
   * The public key for this account
   */


  _createClass(Account, [{
    key: "publicKey",
    get: function get() {
      return new PublicKey(this._keypair.publicKey);
    }
    /**
     * The **unencrypted** secret key for this account
     */

  }, {
    key: "secretKey",
    get: function get() {
      return this._keypair.secretKey;
    }
  }]);

  return Account;
}();

// TODO: These constants should be removed in favor of reading them out of a
// Syscall account

/**
 * @ignore
 */
var NUM_TICKS_PER_SECOND = 160;
/**
 * @ignore
 */

var DEFAULT_TICKS_PER_SLOT = 64;
/**
 * @ignore
 */

var NUM_SLOTS_PER_SECOND = NUM_TICKS_PER_SECOND / DEFAULT_TICKS_PER_SLOT;
/**
 * @ignore
 */

var MS_PER_SLOT = 1000 / NUM_SLOTS_PER_SECOND;

/**
 * Layout for a public key
 */

var publicKey = function publicKey() {
  var property = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'publicKey';
  return blob(32, property);
};
/**
 * Layout for a Rust String type
 */

var rustString = function rustString() {
  var property = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'string';
  var rsl = struct([u32('length'), u32('lengthPadding'), blob(offset(u32(), -8), 'chars')], property);

  var _decode = rsl.decode.bind(rsl);

  var _encode = rsl.encode.bind(rsl);

  rsl.decode = function (buffer, offset) {
    var data = _decode(buffer, offset);

    return data.chars.toString('utf8');
  };

  rsl.encode = function (str, buffer, offset) {
    var data = {
      chars: Buffer.from(str, 'utf8')
    };
    return _encode(data, buffer, offset);
  };

  rsl.alloc = function (str) {
    return u32().span + u32().span + Buffer.from(str, 'utf8').length;
  };

  return rsl;
};
/**
 * Layout for an Authorized object
 */

var authorized = function authorized() {
  var property = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'authorized';
  return struct([publicKey('staker'), publicKey('withdrawer')], property);
};
/**
 * Layout for a Lockup object
 */

var lockup = function lockup() {
  var property = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'lockup';
  return struct([ns64('unixTimestamp'), ns64('epoch'), publicKey('custodian')], property);
};
function getAlloc(type, fields) {
  var alloc = 0;
  type.layout.fields.forEach(function (item) {
    if (item.span >= 0) {
      alloc += item.span;
    } else if (typeof item.alloc === 'function') {
      alloc += item.alloc(fields[item.property]);
    }
  });
  return alloc;
}

function decodeLength(bytes) {
  var len = 0;
  var size = 0;

  for (;;) {
    var elem = bytes.shift();
    len |= (elem & 0x7f) << size * 7;
    size += 1;

    if ((elem & 0x80) === 0) {
      break;
    }
  }

  return len;
}
function encodeLength(bytes, len) {
  var rem_len = len;

  for (;;) {
    var elem = rem_len & 0x7f;
    rem_len >>= 7;

    if (rem_len == 0) {
      bytes.push(elem);
      break;
    } else {
      elem |= 0x80;
      bytes.push(elem);
    }
  }
}

/**
 * The message header, identifying signed and read-only account
 *
 * @typedef {Object} MessageHeader
 * @property {number} numRequiredSignatures The number of signatures required for this message to be considered valid
 * @property {number} numReadonlySignedAccounts: The last `numReadonlySignedAccounts` of the signed keys are read-only accounts
 * @property {number} numReadonlyUnsignedAccounts The last `numReadonlySignedAccounts` of the unsigned keys are read-only accounts
 */

var PUBKEY_LENGTH = 32;
/**
 * List of instructions to be processed atomically
 */

var Message = /*#__PURE__*/function () {
  function Message(args) {
    _classCallCheck(this, Message);

    _defineProperty(this, "header", void 0);

    _defineProperty(this, "accountKeys", void 0);

    _defineProperty(this, "recentBlockhash", void 0);

    _defineProperty(this, "instructions", void 0);

    this.header = args.header;
    this.accountKeys = args.accountKeys.map(function (account) {
      return new PublicKey(account);
    });
    this.recentBlockhash = args.recentBlockhash;
    this.instructions = args.instructions;
  }

  _createClass(Message, [{
    key: "isAccountWritable",
    value: function isAccountWritable(index) {
      return index < this.header.numRequiredSignatures - this.header.numReadonlySignedAccounts || index >= this.header.numRequiredSignatures && index < this.accountKeys.length - this.header.numReadonlyUnsignedAccounts;
    }
  }, {
    key: "serialize",
    value: function serialize() {
      var numKeys = this.accountKeys.length;
      var keyCount = [];
      encodeLength(keyCount, numKeys);
      var instructions = this.instructions.map(function (instruction) {
        var accounts = instruction.accounts,
            programIdIndex = instruction.programIdIndex;
        var data = bs58.decode(instruction.data);
        var keyIndicesCount = [];
        encodeLength(keyIndicesCount, accounts.length);
        var dataCount = [];
        encodeLength(dataCount, data.length);
        return {
          programIdIndex: programIdIndex,
          keyIndicesCount: Buffer.from(keyIndicesCount),
          keyIndices: Buffer.from(accounts),
          dataLength: Buffer.from(dataCount),
          data: data
        };
      });
      var instructionCount = [];
      encodeLength(instructionCount, instructions.length);
      var instructionBuffer = Buffer.alloc(PACKET_DATA_SIZE);
      Buffer.from(instructionCount).copy(instructionBuffer);
      var instructionBufferLength = instructionCount.length;
      instructions.forEach(function (instruction) {
        var instructionLayout = struct([u8('programIdIndex'), blob(instruction.keyIndicesCount.length, 'keyIndicesCount'), seq(u8('keyIndex'), instruction.keyIndices.length, 'keyIndices'), blob(instruction.dataLength.length, 'dataLength'), seq(u8('userdatum'), instruction.data.length, 'data')]);
        var length = instructionLayout.encode(instruction, instructionBuffer, instructionBufferLength);
        instructionBufferLength += length;
      });
      instructionBuffer = instructionBuffer.slice(0, instructionBufferLength);
      var signDataLayout = struct([blob(1, 'numRequiredSignatures'), blob(1, 'numReadonlySignedAccounts'), blob(1, 'numReadonlyUnsignedAccounts'), blob(keyCount.length, 'keyCount'), seq(publicKey('key'), numKeys, 'keys'), publicKey('recentBlockhash')]);
      var transaction = {
        numRequiredSignatures: Buffer.from([this.header.numRequiredSignatures]),
        numReadonlySignedAccounts: Buffer.from([this.header.numReadonlySignedAccounts]),
        numReadonlyUnsignedAccounts: Buffer.from([this.header.numReadonlyUnsignedAccounts]),
        keyCount: Buffer.from(keyCount),
        keys: this.accountKeys.map(function (key) {
          return key.toBuffer();
        }),
        recentBlockhash: bs58.decode(this.recentBlockhash)
      };
      var signData = Buffer.alloc(2048);
      var length = signDataLayout.encode(transaction, signData);
      instructionBuffer.copy(signData, length);
      return signData.slice(0, length + instructionBuffer.length);
    }
    /**
     * Decode a compiled message into a Message object.
     */

  }], [{
    key: "from",
    value: function from(buffer) {
      // Slice up wire data
      var byteArray = _toConsumableArray(buffer);

      var numRequiredSignatures = byteArray.shift();
      var numReadonlySignedAccounts = byteArray.shift();
      var numReadonlyUnsignedAccounts = byteArray.shift();
      var accountCount = decodeLength(byteArray);
      var accountKeys = [];

      for (var i = 0; i < accountCount; i++) {
        var account = byteArray.slice(0, PUBKEY_LENGTH);
        byteArray = byteArray.slice(PUBKEY_LENGTH);
        accountKeys.push(bs58.encode(Buffer.from(account)));
      }

      var recentBlockhash = byteArray.slice(0, PUBKEY_LENGTH);
      byteArray = byteArray.slice(PUBKEY_LENGTH);
      var instructionCount = decodeLength(byteArray);
      var instructions = [];

      for (var _i = 0; _i < instructionCount; _i++) {
        var instruction = {};
        instruction.programIdIndex = byteArray.shift();

        var _accountCount = decodeLength(byteArray);

        instruction.accounts = byteArray.slice(0, _accountCount);
        byteArray = byteArray.slice(_accountCount);
        var dataLength = decodeLength(byteArray);
        var data = byteArray.slice(0, dataLength);
        instruction.data = bs58.encode(Buffer.from(data));
        byteArray = byteArray.slice(dataLength);
        instructions.push(instruction);
      }

      var messageArgs = {
        header: {
          numRequiredSignatures: numRequiredSignatures,
          numReadonlySignedAccounts: numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts: numReadonlyUnsignedAccounts
        },
        recentBlockhash: bs58.encode(Buffer.from(recentBlockhash)),
        accountKeys: accountKeys,
        instructions: instructions
      };
      return new Message(messageArgs);
    }
  }]);

  return Message;
}();

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

/**
 * Default (empty) signature
 *
 * Signatures are 64 bytes in length
 */
var DEFAULT_SIGNATURE = Buffer.alloc(64).fill(0);
/**
 * Maximum over-the-wire size of a Transaction
 *
 * 1280 is IPv6 minimum MTU
 * 40 bytes is the size of the IPv6 header
 * 8 bytes is the size of the fragment header
 */

var PACKET_DATA_SIZE = 1280 - 40 - 8;
var SIGNATURE_LENGTH = 64;
/**
 * Account metadata used to define instructions
 *
 * @typedef {Object} AccountMeta
 * @property {PublicKey} pubkey An account's public key
 * @property {boolean} isSigner True if an instruction requires a transaction signature matching `pubkey`
 * @property {boolean} isWritable True if the `pubkey` can be loaded as a read-write account.
 */

/**
 * Transaction Instruction class
 */
var TransactionInstruction =
/**
 * Public keys to include in this transaction
 * Boolean represents whether this pubkey needs to sign the transaction
 */

/**
 * Program Id to execute
 */

/**
 * Program input
 */
function TransactionInstruction(opts) {
  _classCallCheck(this, TransactionInstruction);

  _defineProperty(this, "keys", []);

  _defineProperty(this, "programId", void 0);

  _defineProperty(this, "data", Buffer.alloc(0));

  opts && Object.assign(this, opts);
};
/**
 * @private
 */

/**
 * Transaction class
 */
var Transaction = /*#__PURE__*/function () {
  _createClass(Transaction, [{
    key: "signature",

    /**
     * Signatures for the transaction.  Typically created by invoking the
     * `sign()` method
     */

    /**
     * The first (payer) Transaction signature
     */
    get: function get() {
      if (this.signatures.length > 0) {
        return this.signatures[0].signature;
      }

      return null;
    }
    /**
     * The instructions to atomically execute
     */

  }]);

  /**
   * Construct an empty Transaction
   */
  function Transaction(opts) {
    _classCallCheck(this, Transaction);

    _defineProperty(this, "signatures", []);

    _defineProperty(this, "instructions", []);

    _defineProperty(this, "recentBlockhash", void 0);

    _defineProperty(this, "nonceInfo", void 0);

    opts && Object.assign(this, opts);
  }
  /**
   * Add one or more instructions to this Transaction
   */


  _createClass(Transaction, [{
    key: "add",
    value: function add() {
      var _this = this;

      for (var _len = arguments.length, items = new Array(_len), _key = 0; _key < _len; _key++) {
        items[_key] = arguments[_key];
      }

      if (items.length === 0) {
        throw new Error('No instructions');
      }

      items.forEach(function (item) {
        if ('instructions' in item) {
          _this.instructions = _this.instructions.concat(item.instructions);
        } else if ('data' in item && 'programId' in item && 'keys' in item) {
          _this.instructions.push(item);
        } else {
          _this.instructions.push(new TransactionInstruction(item));
        }
      });
      return this;
    }
    /**
     * Compile transaction data
     */

  }, {
    key: "compileMessage",
    value: function compileMessage() {
      var nonceInfo = this.nonceInfo;

      if (nonceInfo && this.instructions[0] != nonceInfo.nonceInstruction) {
        this.recentBlockhash = nonceInfo.nonce;
        this.instructions.unshift(nonceInfo.nonceInstruction);
      }

      var recentBlockhash = this.recentBlockhash;

      if (!recentBlockhash) {
        throw new Error('Transaction recentBlockhash required');
      }

      if (this.instructions.length < 1) {
        throw new Error('No instructions provided');
      }

      var numReadonlySignedAccounts = 0;
      var numReadonlyUnsignedAccounts = 0;
      var programIds = [];
      var accountMetas = [];
      this.instructions.forEach(function (instruction) {
        instruction.keys.forEach(function (accountMeta) {
          accountMetas.push(accountMeta);
        });
        var programId = instruction.programId.toString();

        if (!programIds.includes(programId)) {
          programIds.push(programId);
        }
      }); // Append programID account metas

      programIds.forEach(function (programId) {
        accountMetas.push({
          pubkey: new PublicKey(programId),
          isSigner: false,
          isWritable: false
        });
      }); // Prefix accountMetas with feePayer here whenever that gets implemented
      // Sort. Prioritizing first by signer, then by writable

      accountMetas.sort(function (x, y) {
        var checkSigner = x.isSigner === y.isSigner ? 0 : x.isSigner ? -1 : 1;
        var checkWritable = x.isWritable === y.isWritable ? 0 : x.isWritable ? -1 : 1;
        return checkSigner || checkWritable;
      }); // Cull duplicate account metas

      var uniqueMetas = [];
      accountMetas.forEach(function (accountMeta) {
        var pubkeyString = accountMeta.pubkey.toString();
        var uniqueIndex = uniqueMetas.findIndex(function (x) {
          return x.pubkey.toString() === pubkeyString;
        });

        if (uniqueIndex > -1) {
          uniqueMetas[uniqueIndex].isWritable = uniqueMetas[uniqueIndex].isWritable || accountMeta.isWritable;
        } else {
          uniqueMetas.push(accountMeta);
        }
      });
      this.signatures.forEach(function (signature) {
        var sigPubkeyString = signature.publicKey.toString();
        var uniqueIndex = uniqueMetas.findIndex(function (x) {
          return x.pubkey.toString() === sigPubkeyString;
        });

        if (uniqueIndex > -1) {
          uniqueMetas[uniqueIndex].isSigner = true;
        } else {
          uniqueMetas.unshift({
            pubkey: new PublicKey(sigPubkeyString),
            isSigner: true,
            isWritable: true
          });
        }
      }); // Split out signing from nonsigning keys and count readonlys

      var signedKeys = [];
      var unsignedKeys = [];
      uniqueMetas.forEach(function (_ref) {
        var pubkey = _ref.pubkey,
            isSigner = _ref.isSigner,
            isWritable = _ref.isWritable;

        if (isSigner) {
          // Promote the first signer to writable as it is the fee payer
          var first = signedKeys.length === 0;
          signedKeys.push(pubkey.toString());

          if (!first && !isWritable) {
            numReadonlySignedAccounts += 1;
          }
        } else {
          unsignedKeys.push(pubkey.toString());

          if (!isWritable) {
            numReadonlyUnsignedAccounts += 1;
          }
        }
      }); // Initialize signature array, if needed

      if (this.signatures.length === 0) {
        var signatures = [];
        signedKeys.forEach(function (pubkey) {
          signatures.push({
            signature: null,
            publicKey: new PublicKey(pubkey)
          });
        });
        this.signatures = signatures;
      }

      var accountKeys = signedKeys.concat(unsignedKeys);
      var instructions = this.instructions.map(function (instruction) {
        var data = instruction.data,
            programId = instruction.programId;
        return {
          programIdIndex: accountKeys.indexOf(programId.toString()),
          accounts: instruction.keys.map(function (keyObj) {
            return accountKeys.indexOf(keyObj.pubkey.toString());
          }),
          data: bs58.encode(data)
        };
      });
      instructions.forEach(function (instruction) {
        assert(instruction.programIdIndex >= 0);
        instruction.accounts.forEach(function (keyIndex) {
          return assert(keyIndex >= 0);
        });
      });
      return new Message({
        header: {
          numRequiredSignatures: this.signatures.length,
          numReadonlySignedAccounts: numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts: numReadonlyUnsignedAccounts
        },
        accountKeys: accountKeys,
        recentBlockhash: recentBlockhash,
        instructions: instructions
      });
    }
    /**
     * Get a buffer of the Transaction data that need to be covered by signatures
     */

  }, {
    key: "serializeMessage",
    value: function serializeMessage() {
      return this.compileMessage().serialize();
    }
    /**
     * Sign the Transaction with the specified accounts.  Multiple signatures may
     * be applied to a Transaction. The first signature is considered "primary"
     * and is used when testing for Transaction confirmation.
     *
     * Transaction fields should not be modified after the first call to `sign`,
     * as doing so may invalidate the signature and cause the Transaction to be
     * rejected.
     *
     * The Transaction must be assigned a valid `recentBlockhash` before invoking this method
     */

  }, {
    key: "sign",
    value: function sign() {
      this.signPartial.apply(this, arguments);
    }
    /**
     * Partially sign a Transaction with the specified accounts.  The `Account`
     * inputs will be used to sign the Transaction immediately, while any
     * `PublicKey` inputs will be referenced in the signed Transaction but need to
     * be filled in later by calling `addSigner()` with the matching `Account`.
     *
     * All the caveats from the `sign` method apply to `signPartial`
     */

  }, {
    key: "signPartial",
    value: function signPartial() {
      for (var _len2 = arguments.length, partialSigners = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        partialSigners[_key2] = arguments[_key2];
      }

      if (partialSigners.length === 0) {
        throw new Error('No signers');
      }

      function partialSignerPublicKey(accountOrPublicKey) {
        if ('publicKey' in accountOrPublicKey) {
          return accountOrPublicKey.publicKey;
        }

        return accountOrPublicKey;
      }

      function signerAccount(accountOrPublicKey) {
        if ('publicKey' in accountOrPublicKey && 'secretKey' in accountOrPublicKey) {
          return accountOrPublicKey;
        }
      }

      var signatures = partialSigners.map(function (accountOrPublicKey) {
        return {
          signature: null,
          publicKey: partialSignerPublicKey(accountOrPublicKey)
        };
      });
      this.signatures = signatures;
      var signData = this.serializeMessage();
      partialSigners.forEach(function (accountOrPublicKey, index) {
        var account = signerAccount(accountOrPublicKey);

        if (account) {
          var signature = nacl.sign.detached(signData, account.secretKey);
          assert(signature.length === 64);
          signatures[index].signature = Buffer.from(signature);
        }
      });
    }
    /**
     * Fill in a signature for a partially signed Transaction.  The `signer` must
     * be the corresponding `Account` for a `PublicKey` that was previously provided to
     * `signPartial`
     */

  }, {
    key: "addSigner",
    value: function addSigner(signer) {
      var signData = this.serializeMessage();
      var signature = nacl.sign.detached(signData, signer.secretKey);
      this.addSignature(signer.publicKey, signature);
    }
    /**
     * Add an externally created signature to a transaction
     */

  }, {
    key: "addSignature",
    value: function addSignature(pubkey, signature) {
      assert(signature.length === 64);
      var index = this.signatures.findIndex(function (sigpair) {
        return pubkey.equals(sigpair.publicKey);
      });

      if (index < 0) {
        throw new Error("Unknown signer: ".concat(pubkey.toString()));
      }

      this.signatures[index].signature = Buffer.from(signature);
    }
    /**
     * Verify signatures of a complete, signed Transaction
     */

  }, {
    key: "verifySignatures",
    value: function verifySignatures() {
      return this._verifySignatures(this.serializeMessage());
    }
    /**
     * @private
     */

  }, {
    key: "_verifySignatures",
    value: function _verifySignatures(signData) {
      var verified = true;

      var _iterator = _createForOfIteratorHelper(this.signatures),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var _step$value = _step.value,
              signature = _step$value.signature,
              publicKey = _step$value.publicKey;

          if (!nacl.sign.detached.verify(signData, signature, publicKey.toBuffer())) {
            verified = false;
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      return verified;
    }
    /**
     * Serialize the Transaction in the wire format.
     *
     * The Transaction must have a valid `signature` before invoking this method
     */

  }, {
    key: "serialize",
    value: function serialize() {
      var signatures = this.signatures;

      if (!signatures || signatures.length === 0) {
        throw new Error('Transaction has not been signed');
      }

      var signData = this.serializeMessage();

      if (!this._verifySignatures(signData)) {
        throw new Error('Transaction has not been signed correctly');
      }

      return this._serialize(signData);
    }
    /**
     * @private
     */

  }, {
    key: "_serialize",
    value: function _serialize(signData) {
      var signatures = this.signatures;
      var signatureCount = [];
      encodeLength(signatureCount, signatures.length);
      var transactionLength = signatureCount.length + signatures.length * 64 + signData.length;
      var wireTransaction = Buffer.alloc(transactionLength);
      assert(signatures.length < 256);
      Buffer.from(signatureCount).copy(wireTransaction, 0);
      signatures.forEach(function (_ref2, index) {
        var signature = _ref2.signature;

        if (signature !== null) {
          assert(signature.length === 64, "signature has invalid length");
          Buffer.from(signature).copy(wireTransaction, signatureCount.length + index * 64);
        }
      });
      signData.copy(wireTransaction, signatureCount.length + signatures.length * 64);
      assert(wireTransaction.length <= PACKET_DATA_SIZE, "Transaction too large: ".concat(wireTransaction.length, " > ").concat(PACKET_DATA_SIZE));
      return wireTransaction;
    }
    /**
     * Deprecated method
     * @private
     */

  }, {
    key: "keys",
    get: function get() {
      assert(this.instructions.length === 1);
      return this.instructions[0].keys.map(function (keyObj) {
        return keyObj.pubkey;
      });
    }
    /**
     * Deprecated method
     * @private
     */

  }, {
    key: "programId",
    get: function get() {
      assert(this.instructions.length === 1);
      return this.instructions[0].programId;
    }
    /**
     * Deprecated method
     * @private
     */

  }, {
    key: "data",
    get: function get() {
      assert(this.instructions.length === 1);
      return this.instructions[0].data;
    }
    /**
     * Parse a wire transaction into a Transaction object.
     */

  }], [{
    key: "from",
    value: function from(buffer) {
      // Slice up wire data
      var byteArray = _toConsumableArray(buffer);

      var signatureCount = decodeLength(byteArray);
      var signatures = [];

      for (var i = 0; i < signatureCount; i++) {
        var signature = byteArray.slice(0, SIGNATURE_LENGTH);
        byteArray = byteArray.slice(SIGNATURE_LENGTH);
        signatures.push(bs58.encode(Buffer.from(signature)));
      }

      return Transaction.populate(Message.from(byteArray), signatures);
    }
    /**
     * Populate Transaction object from message and signatures
     */

  }, {
    key: "populate",
    value: function populate(message, signatures) {
      var transaction = new Transaction();
      transaction.recentBlockhash = message.recentBlockhash;
      signatures.forEach(function (signature, index) {
        var sigPubkeyPair = {
          signature: signature == bs58.encode(DEFAULT_SIGNATURE) ? null : bs58.decode(signature),
          publicKey: message.accountKeys[index]
        };
        transaction.signatures.push(sigPubkeyPair);
      });
      message.instructions.forEach(function (instruction) {
        var keys = instruction.accounts.map(function (account) {
          var pubkey = message.accountKeys[account];
          return {
            pubkey: pubkey,
            isSigner: transaction.signatures.some(function (keyObj) {
              return keyObj.publicKey.toString() === pubkey.toString();
            }),
            isWritable: message.isAccountWritable(account)
          };
        });
        transaction.instructions.push(new TransactionInstruction({
          keys: keys,
          programId: message.accountKeys[instruction.programIdIndex],
          data: bs58.decode(instruction.data)
        }));
      });
      return transaction;
    }
  }]);

  return Transaction;
}();

var SYSVAR_CLOCK_PUBKEY = new PublicKey('SysvarC1ock11111111111111111111111111111111');
var SYSVAR_RECENT_BLOCKHASHES_PUBKEY = new PublicKey('SysvarRecentB1ockHashes11111111111111111111');
var SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');
var SYSVAR_REWARDS_PUBKEY = new PublicKey('SysvarRewards111111111111111111111111111111');
var SYSVAR_STAKE_HISTORY_PUBKEY = new PublicKey('SysvarStakeHistory1111111111111111111111111');

/**
 * https://github.com/solana-labs/solana/blob/90bedd7e067b5b8f3ddbb45da00a4e9cabb22c62/sdk/src/fee_calculator.rs#L7-L11
 *
 * @private
 */

var FeeCalculatorLayout = nu64('lamportsPerSignature');
/**
 * @typedef {Object} FeeCalculator
 * @property {number} lamportsPerSignature lamports Cost in lamports to validate a signature
 */

/**
 * See https://github.com/solana-labs/solana/blob/0ea2843ec9cdc517572b8e62c959f41b55cf4453/sdk/src/nonce_state.rs#L29-L32
 *
 * @private
 */

var NonceAccountLayout = struct([u32('version'), u32('state'), publicKey('authorizedPubkey'), publicKey('nonce'), struct([FeeCalculatorLayout], 'feeCalculator')]);
var NONCE_ACCOUNT_LENGTH = NonceAccountLayout.span;
/**
 * NonceAccount class
 */

var NonceAccount = /*#__PURE__*/function () {
  function NonceAccount() {
    _classCallCheck(this, NonceAccount);

    _defineProperty(this, "authorizedPubkey", void 0);

    _defineProperty(this, "nonce", void 0);

    _defineProperty(this, "feeCalculator", void 0);
  }

  _createClass(NonceAccount, null, [{
    key: "fromAccountData",

    /**
     * Deserialize NonceAccount from the account data.
     *
     * @param buffer account data
     * @return NonceAccount
     */
    value: function fromAccountData(buffer) {
      var nonceAccount = NonceAccountLayout.decode(toBuffer(buffer), 0);
      nonceAccount.authorizedPubkey = new PublicKey(nonceAccount.authorizedPubkey);
      nonceAccount.nonce = new PublicKey(nonceAccount.nonce).toString();
      return nonceAccount;
    }
  }]);

  return NonceAccount;
}();

// zzz
function sleep(ms) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, ms);
  });
}

function _createForOfIteratorHelper$1(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$1(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray$1(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$1(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$1(o, minLen); }

function _arrayLikeToArray$1(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }
var BLOCKHASH_CACHE_TIMEOUT_MS = 30 * 1000;

/**
 * @private
 */
function jsonRpcResultAndContext(resultDescription) {
  return jsonRpcResult({
    context: struct$1({
      slot: 'number'
    }),
    value: resultDescription
  });
}
/**
 * @private
 */


function jsonRpcResult(resultDescription) {
  var jsonRpcVersion = struct$1.literal('2.0');
  return struct$1.union([struct$1({
    jsonrpc: jsonRpcVersion,
    id: 'string',
    error: 'any'
  }), struct$1({
    jsonrpc: jsonRpcVersion,
    id: 'string',
    error: 'null?',
    result: resultDescription
  })]);
}
/**
 * @private
 */


function notificationResultAndContext(resultDescription) {
  return struct$1({
    context: struct$1({
      slot: 'number'
    }),
    value: resultDescription
  });
}
/**
 * The level of commitment desired when querying state
 * <pre>
 *   'max':    Query the most recent block which has been finalized by the cluster
 *   'recent': Query the most recent block which has reached 1 confirmation by the connected node
 *   'root':   Query the most recent block which has been rooted by the connected node
 *   'single': Query the most recent block which has reached 1 confirmation by the cluster
 *   'singleGossip': Query the most recent block which has reached 1 confirmation according to votes seen in gossip
 * </pre>
 *
 * @typedef {'max' | 'recent' | 'root' | 'single' | 'singleGossip'} Commitment
 */


var GetInflationGovernorResult = struct$1({
  foundation: 'number',
  foundationTerm: 'number',
  initial: 'number',
  taper: 'number',
  terminal: 'number'
});
/**
 * Information about the current epoch
 *
 * @typedef {Object} EpochInfo
 * @property {number} epoch
 * @property {number} slotIndex
 * @property {number} slotsInEpoch
 * @property {number} absoluteSlot
 * @property {number} blockHeight
 */

var GetEpochInfoResult = struct$1({
  epoch: 'number',
  slotIndex: 'number',
  slotsInEpoch: 'number',
  absoluteSlot: 'number',
  blockHeight: 'number?'
});
/**
 * Epoch schedule
 * (see https://docs.solana.com/terminology#epoch)
 *
 * @typedef {Object} EpochSchedule
 * @property {number} slotsPerEpoch The maximum number of slots in each epoch
 * @property {number} leaderScheduleSlotOffset The number of slots before beginning of an epoch to calculate a leader schedule for that epoch
 * @property {boolean} warmup Indicates whether epochs start short and grow
 * @property {number} firstNormalEpoch The first epoch with `slotsPerEpoch` slots
 * @property {number} firstNormalSlot The first slot of `firstNormalEpoch`
 */

var GetEpochScheduleResult = struct$1({
  slotsPerEpoch: 'number',
  leaderScheduleSlotOffset: 'number',
  warmup: 'boolean',
  firstNormalEpoch: 'number',
  firstNormalSlot: 'number'
});
/**
 * Leader schedule
 * (see https://docs.solana.com/terminology#leader-schedule)
 *
 * @typedef {Object} LeaderSchedule
 */

var GetLeaderScheduleResult = struct$1.record(['string', struct$1.array(['number'])]);
/**
 * Transaction error or null
 */

var TransactionErrorResult = struct$1.union(['null', 'object']);
/**
 * Signature status for a transaction
 */

var SignatureStatusResult = struct$1({
  err: TransactionErrorResult
});
/**
 * Version info for a node
 *
 * @typedef {Object} Version
 * @property {string} solana-core Version of solana-core
 */

var Version = struct$1({
  'solana-core': 'string'
});
var SimulatedTransactionResponseValidator = jsonRpcResultAndContext(struct$1.pick({
  err: struct$1.union(['null', 'object', 'string']),
  logs: struct$1.union(['null', struct$1.array(['string'])])
}));
/**
 * Metadata for a confirmed transaction on the ledger
 *
 * @typedef {Object} ConfirmedTransactionMeta
 * @property {number} fee The fee charged for processing the transaction
 * @property {Array<number>} preBalances The balances of the transaction accounts before processing
 * @property {Array<number>} postBalances The balances of the transaction accounts after processing
 * @property {object|null} err The error result of transaction processing
 */

function createRpcRequest(url) {
  var server = jayson( /*#__PURE__*/function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(request, callback) {
      var options, too_many_requests_retries, res, text;
      return _regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              options = {
                method: 'POST',
                body: request,
                headers: {
                  'Content-Type': 'application/json'
                }
              };
              _context.prev = 1;
              too_many_requests_retries = 5;
              res = {};

            case 4:
              _context.next = 6;
              return fetch(url, options);

            case 6:
              res = _context.sent;

              if (!(res.status !== 429
              /* Too many requests */
              || too_many_requests_retries === 0)) {
                _context.next = 9;
                break;
              }

              return _context.abrupt("break", 15);

            case 9:
              console.log("Server responded with ".concat(res.status, " ").concat(res.statusText, ".  Retrying after brief delay..."));
              _context.next = 12;
              return sleep(500);

            case 12:
              too_many_requests_retries -= 1;

            case 13:
              _context.next = 4;
              break;

            case 15:
              _context.next = 17;
              return res.text();

            case 17:
              text = _context.sent;

              if (res.ok) {
                callback(null, text);
              } else {
                callback(new Error("".concat(res.status, " ").concat(res.statusText, ": ").concat(text)));
              }

              _context.next = 24;
              break;

            case 21:
              _context.prev = 21;
              _context.t0 = _context["catch"](1);
              callback(_context.t0);

            case 24:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, null, [[1, 21]]);
    }));

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }());
  return function (method, args) {
    return new Promise(function (resolve, reject) {
      server.request(method, args, function (err, response) {
        if (err) {
          reject(err);
          return;
        }

        resolve(response);
      });
    });
  };
}
/**
 * Expected JSON RPC response for the "getInflationGovernor" message
 */


var GetInflationGovernorRpcResult = struct$1({
  jsonrpc: struct$1.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: GetInflationGovernorResult
});
/**
 * Expected JSON RPC response for the "getEpochInfo" message
 */

var GetEpochInfoRpcResult = struct$1({
  jsonrpc: struct$1.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: GetEpochInfoResult
});
/**
 * Expected JSON RPC response for the "getEpochSchedule" message
 */

var GetEpochScheduleRpcResult = struct$1({
  jsonrpc: struct$1.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: GetEpochScheduleResult
});
/**
 * Expected JSON RPC response for the "getLeaderSchedule" message
 */

var GetLeaderScheduleRpcResult = jsonRpcResult(GetLeaderScheduleResult);
/**
 * Expected JSON RPC response for the "getBalance" message
 */

var GetBalanceAndContextRpcResult = jsonRpcResultAndContext('number?');
/**
 * Expected JSON RPC response for the "getBlockTime" message
 */

var GetBlockTimeRpcResult = struct$1({
  jsonrpc: struct$1.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: struct$1.union(['null', 'number', 'undefined'])
});
/**
 * Expected JSON RPC response for the "minimumLedgerSlot" and "getFirstAvailableBlock" messages
 */

var SlotRpcResult = struct$1({
  jsonrpc: struct$1.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: 'number'
});
/**
 * Supply
 *
 * @typedef {Object} Supply
 * @property {number} total Total supply in lamports
 * @property {number} circulating Circulating supply in lamports
 * @property {number} nonCirculating Non-circulating supply in lamports
 * @property {Array<PublicKey>} nonCirculatingAccounts List of non-circulating account addresses
 */

/**
 * Expected JSON RPC response for the "getSupply" message
 */
var GetSupplyRpcResult = jsonRpcResultAndContext(struct$1({
  total: 'number',
  circulating: 'number',
  nonCirculating: 'number',
  nonCirculatingAccounts: struct$1.array(['string'])
}));
/**
 * Token amount object which returns a token amount in different formats
 * for various client use cases.
 *
 * @typedef {Object} TokenAmount
 * @property {string} amount Raw amount of tokens as string ignoring decimals
 * @property {number} decimals Number of decimals configured for token's mint
 * @property {number} uiAmount Token account as float, accounts for decimals
 */

/**
 * Expected JSON RPC structure for token amounts
 */
var TokenAmountResult = struct$1.object({
  amount: 'string',
  uiAmount: 'number',
  decimals: 'number'
});
/**
 * Token address and balance.
 *
 * @typedef {Object} TokenAccountBalancePair
 * @property {PublicKey} address Address of the token account
 * @property {string} amount Raw amount of tokens as string ignoring decimals
 * @property {number} decimals Number of decimals configured for token's mint
 * @property {number} uiAmount Token account as float, accounts for decimals
 */

/**
 * Expected JSON RPC response for the "getTokenLargestAccounts" message
 */
var GetTokenLargestAccountsResult = jsonRpcResultAndContext(struct$1.array([struct$1.pick({
  address: 'string',
  amount: 'string',
  uiAmount: 'number',
  decimals: 'number'
})]));
/**
 * Expected JSON RPC response for the "getTokenAccountBalance" message
 */

var GetTokenAccountBalance = jsonRpcResultAndContext(TokenAmountResult);
/**
 * Expected JSON RPC response for the "getTokenSupply" message
 */

var GetTokenSupplyRpcResult = jsonRpcResultAndContext(TokenAmountResult);
/**
 * Expected JSON RPC response for the "getTokenAccountsByOwner" message
 */

var GetTokenAccountsByOwner = jsonRpcResultAndContext(struct$1.array([struct$1.object({
  pubkey: 'string',
  account: struct$1.object({
    executable: 'boolean',
    owner: 'string',
    lamports: 'number',
    data: ['string', struct$1.literal('base64')],
    rentEpoch: 'number?'
  })
})]));
/**
 * Expected JSON RPC response for the "getTokenAccountsByOwner" message with parsed data
 */

var GetParsedTokenAccountsByOwner = jsonRpcResultAndContext(struct$1.array([struct$1.object({
  pubkey: 'string',
  account: struct$1.object({
    executable: 'boolean',
    owner: 'string',
    lamports: 'number',
    data: struct$1.pick({
      program: 'string',
      parsed: 'any',
      space: 'number'
    }),
    rentEpoch: 'number?'
  })
})]));
/**
 * Pair of an account address and its balance
 *
 * @typedef {Object} AccountBalancePair
 * @property {PublicKey} address
 * @property {number} lamports
 */

/**
 * Expected JSON RPC response for the "getLargestAccounts" message
 */
var GetLargestAccountsRpcResult = jsonRpcResultAndContext(struct$1.array([struct$1({
  lamports: 'number',
  address: 'string'
})]));
/**
 * Expected JSON RPC response for the "getVersion" message
 */

var GetVersionRpcResult = struct$1({
  jsonrpc: struct$1.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: Version
});
/**
 * @private
 */

var AccountInfoResult = struct$1({
  executable: 'boolean',
  owner: 'string',
  lamports: 'number',
  data: 'any',
  rentEpoch: 'number?'
});
/**
 * @private
 */

var ParsedAccountInfoResult = struct$1.object({
  executable: 'boolean',
  owner: 'string',
  lamports: 'number',
  data: struct$1.union([['string', struct$1.literal('base64')], struct$1.pick({
    program: 'string',
    parsed: 'any',
    space: 'number'
  })]),
  rentEpoch: 'number?'
});
/**
 * Expected JSON RPC response for the "getAccountInfo" message
 */

var GetAccountInfoAndContextRpcResult = jsonRpcResultAndContext(struct$1.union(['null', AccountInfoResult]));
/**
 * Expected JSON RPC response for the "getAccountInfo" message with jsonParsed param
 */

var GetParsedAccountInfoResult = jsonRpcResultAndContext(struct$1.union(['null', ParsedAccountInfoResult]));
/**
 * Expected JSON RPC response for the "getConfirmedSignaturesForAddress" message
 */

var GetConfirmedSignaturesForAddressRpcResult = jsonRpcResult(struct$1.array(['string']));
/**
 * Expected JSON RPC response for the "getConfirmedSignaturesForAddress2" message
 */

var GetConfirmedSignaturesForAddress2RpcResult = jsonRpcResult(struct$1.array([struct$1({
  signature: 'string',
  slot: 'number',
  err: TransactionErrorResult,
  memo: struct$1.union(['null', 'string'])
})]));
/***
 * Expected JSON RPC response for the "accountNotification" message
 */

var AccountNotificationResult = struct$1({
  subscription: 'number',
  result: notificationResultAndContext(AccountInfoResult)
});
/**
 * @private
 */

var ProgramAccountInfoResult = struct$1({
  pubkey: 'string',
  account: AccountInfoResult
});
/**
 * @private
 */

var ParsedProgramAccountInfoResult = struct$1({
  pubkey: 'string',
  account: ParsedAccountInfoResult
});
/***
 * Expected JSON RPC response for the "programNotification" message
 */

var ProgramAccountNotificationResult = struct$1({
  subscription: 'number',
  result: notificationResultAndContext(ProgramAccountInfoResult)
});
/**
 * @private
 */

var SlotInfoResult = struct$1({
  parent: 'number',
  slot: 'number',
  root: 'number'
});
/**
 * Expected JSON RPC response for the "slotNotification" message
 */

var SlotNotificationResult = struct$1({
  subscription: 'number',
  result: SlotInfoResult
});
/**
 * Expected JSON RPC response for the "signatureNotification" message
 */

var SignatureNotificationResult = struct$1({
  subscription: 'number',
  result: notificationResultAndContext(SignatureStatusResult)
});
/**
 * Expected JSON RPC response for the "rootNotification" message
 */

var RootNotificationResult = struct$1({
  subscription: 'number',
  result: 'number'
});
/**
 * Expected JSON RPC response for the "getProgramAccounts" message
 */

var GetProgramAccountsRpcResult = jsonRpcResult(struct$1.array([ProgramAccountInfoResult]));
/**
 * Expected JSON RPC response for the "getProgramAccounts" message
 */

var GetParsedProgramAccountsRpcResult = jsonRpcResult(struct$1.array([ParsedProgramAccountInfoResult]));
/**
 * Expected JSON RPC response for the "getSlot" message
 */

var GetSlot = jsonRpcResult('number');
/**
 * Expected JSON RPC response for the "getSlotLeader" message
 */

var GetSlotLeader = jsonRpcResult('string');
/**
 * Expected JSON RPC response for the "getClusterNodes" message
 */

var GetClusterNodes = jsonRpcResult(struct$1.array([struct$1.pick({
  pubkey: 'string',
  gossip: struct$1.union(['null', 'string']),
  tpu: struct$1.union(['null', 'string']),
  rpc: struct$1.union(['null', 'string']),
  version: struct$1.union(['null', 'string'])
})]));
/**
 * Expected JSON RPC response for the "getVoteAccounts" message
 */

var GetVoteAccounts = jsonRpcResult(struct$1({
  current: struct$1.array([struct$1.pick({
    votePubkey: 'string',
    nodePubkey: 'string',
    activatedStake: 'number',
    epochVoteAccount: 'boolean',
    epochCredits: struct$1.array([struct$1.tuple(['number', 'number', 'number'])]),
    commission: 'number',
    lastVote: 'number',
    rootSlot: 'number?'
  })]),
  delinquent: struct$1.array([struct$1.pick({
    votePubkey: 'string',
    nodePubkey: 'string',
    activatedStake: 'number',
    epochVoteAccount: 'boolean',
    epochCredits: struct$1.array([struct$1.tuple(['number', 'number', 'number'])]),
    commission: 'number',
    lastVote: 'number',
    rootSlot: 'number?'
  })])
}));
/**
 * Expected JSON RPC response for the "getSignatureStatuses" message
 */

var GetSignatureStatusesRpcResult = jsonRpcResultAndContext(struct$1.array([struct$1.union(['null', struct$1.pick({
  slot: 'number',
  confirmations: struct$1.union(['number', 'null']),
  err: TransactionErrorResult
})])]));
/**
 * Expected JSON RPC response for the "getTransactionCount" message
 */

var GetTransactionCountRpcResult = jsonRpcResult('number');
/**
 * Expected JSON RPC response for the "getTotalSupply" message
 */

var GetTotalSupplyRpcResult = jsonRpcResult('number');
/**
 * Expected JSON RPC response for the "getMinimumBalanceForRentExemption" message
 */

var GetMinimumBalanceForRentExemptionRpcResult = jsonRpcResult('number');
/**
 * @private
 */

var ConfirmedTransactionResult = struct$1({
  signatures: struct$1.array(['string']),
  message: struct$1({
    accountKeys: struct$1.array(['string']),
    header: struct$1({
      numRequiredSignatures: 'number',
      numReadonlySignedAccounts: 'number',
      numReadonlyUnsignedAccounts: 'number'
    }),
    instructions: struct$1.array([struct$1({
      accounts: struct$1.array(['number']),
      data: 'string',
      programIdIndex: 'number'
    })]),
    recentBlockhash: 'string'
  })
});
/**
 * @private
 */

var ParsedConfirmedTransactionResult = struct$1({
  signatures: struct$1.array(['string']),
  message: struct$1({
    accountKeys: struct$1.array([struct$1({
      pubkey: 'string',
      signer: 'boolean',
      writable: 'boolean'
    })]),
    instructions: struct$1.array([struct$1.union([struct$1({
      accounts: struct$1.array(['string']),
      data: 'string',
      programId: 'string'
    }), struct$1({
      parsed: 'any',
      program: 'string',
      programId: 'string'
    })])]),
    recentBlockhash: 'string'
  })
});
/**
 * @private
 */

var ConfirmedTransactionMetaResult = struct$1.union(['null', struct$1.pick({
  err: TransactionErrorResult,
  fee: 'number',
  preBalances: struct$1.array(['number']),
  postBalances: struct$1.array(['number'])
})]);
/**
 * Expected JSON RPC response for the "getConfirmedBlock" message
 */

var GetConfirmedBlockRpcResult = jsonRpcResult(struct$1.union(['null', struct$1.pick({
  blockhash: 'string',
  previousBlockhash: 'string',
  parentSlot: 'number',
  transactions: struct$1.array([struct$1({
    transaction: ConfirmedTransactionResult,
    meta: ConfirmedTransactionMetaResult
  })]),
  rewards: struct$1.union(['undefined', struct$1.array([struct$1({
    pubkey: 'string',
    lamports: 'number'
  })])])
})]));
/**
 * Expected JSON RPC response for the "getConfirmedTransaction" message
 */

var GetConfirmedTransactionRpcResult = jsonRpcResult(struct$1.union(['null', struct$1.pick({
  slot: 'number',
  transaction: ConfirmedTransactionResult,
  meta: ConfirmedTransactionMetaResult
})]));
/**
 * Expected JSON RPC response for the "getConfirmedTransaction" message
 */

var GetParsedConfirmedTransactionRpcResult = jsonRpcResult(struct$1.union(['null', struct$1.pick({
  slot: 'number',
  transaction: ParsedConfirmedTransactionResult,
  meta: ConfirmedTransactionMetaResult
})]));
/**
 * Expected JSON RPC response for the "getRecentBlockhash" message
 */

var GetRecentBlockhashAndContextRpcResult = jsonRpcResultAndContext(struct$1({
  blockhash: 'string',
  feeCalculator: struct$1({
    lamportsPerSignature: 'number'
  })
}));
/**
 * Expected JSON RPC response for the "getFeeCalculatorForBlockhash" message
 */

var GetFeeCalculatorRpcResult = jsonRpcResultAndContext(struct$1.union(['null', struct$1({
  feeCalculator: struct$1({
    lamportsPerSignature: 'number'
  })
})]));
/**
 * Expected JSON RPC response for the "requestAirdrop" message
 */

var RequestAirdropRpcResult = jsonRpcResult('string');
/**
 * Expected JSON RPC response for the "sendTransaction" message
 */

var SendTransactionRpcResult = jsonRpcResult('string');
/**
 * Information about the latest slot being processed by a node
 *
 * @typedef {Object} SlotInfo
 * @property {number} slot Currently processing slot
 * @property {number} parent Parent of the current slot
 * @property {number} root The root block of the current slot's fork
 */

/**
 * A connection to a fullnode JSON RPC endpoint
 */
var Connection = /*#__PURE__*/function () {
  /**
   * Establish a JSON RPC connection
   *
   * @param endpoint URL to the fullnode JSON RPC endpoint
   * @param commitment optional default commitment level
   */
  function Connection(endpoint, commitment) {
    _classCallCheck(this, Connection);

    _defineProperty(this, "_rpcRequest", void 0);

    _defineProperty(this, "_rpcWebSocket", void 0);

    _defineProperty(this, "_rpcWebSocketConnected", false);

    _defineProperty(this, "_commitment", void 0);

    _defineProperty(this, "_blockhashInfo", void 0);

    _defineProperty(this, "_disableBlockhashCaching", false);

    _defineProperty(this, "_accountChangeSubscriptions", {});

    _defineProperty(this, "_accountChangeSubscriptionCounter", 0);

    _defineProperty(this, "_programAccountChangeSubscriptions", {});

    _defineProperty(this, "_programAccountChangeSubscriptionCounter", 0);

    _defineProperty(this, "_slotSubscriptions", {});

    _defineProperty(this, "_slotSubscriptionCounter", 0);

    _defineProperty(this, "_signatureSubscriptions", {});

    _defineProperty(this, "_signatureSubscriptionCounter", 0);

    _defineProperty(this, "_rootSubscriptions", {});

    _defineProperty(this, "_rootSubscriptionCounter", 0);

    var url = parse(endpoint);
    this._rpcRequest = createRpcRequest(url.href);
    this._commitment = commitment;
    this._blockhashInfo = {
      recentBlockhash: null,
      lastFetch: new Date(0),
      transactionSignatures: [],
      simulatedSignatures: []
    };
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.host = '';

    if (url.port !== null) {
      url.port = String(Number(url.port) + 1);
    }

    this._rpcWebSocket = new Client(format(url), {
      autoconnect: false,
      max_reconnects: Infinity
    });

    this._rpcWebSocket.on('open', this._wsOnOpen.bind(this));

    this._rpcWebSocket.on('error', this._wsOnError.bind(this));

    this._rpcWebSocket.on('close', this._wsOnClose.bind(this));

    this._rpcWebSocket.on('accountNotification', this._wsOnAccountNotification.bind(this));

    this._rpcWebSocket.on('programNotification', this._wsOnProgramAccountNotification.bind(this));

    this._rpcWebSocket.on('slotNotification', this._wsOnSlotNotification.bind(this));

    this._rpcWebSocket.on('signatureNotification', this._wsOnSignatureNotification.bind(this));

    this._rpcWebSocket.on('rootNotification', this._wsOnRootNotification.bind(this));
  }
  /**
   * The default commitment used for requests
   */


  _createClass(Connection, [{
    key: "getBalanceAndContext",

    /**
     * Fetch the balance for the specified public key, return with context
     */
    value: function () {
      var _getBalanceAndContext = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee2(publicKey, commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                args = this._buildArgs([publicKey.toBase58()], commitment);
                _context2.next = 3;
                return this._rpcRequest('getBalance', args);

              case 3:
                unsafeRes = _context2.sent;
                res = GetBalanceAndContextRpcResult(unsafeRes);

                if (!res.error) {
                  _context2.next = 7;
                  break;
                }

                throw new Error('failed to get balance for ' + publicKey.toBase58() + ': ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context2.abrupt("return", res.result);

              case 9:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function getBalanceAndContext(_x3, _x4) {
        return _getBalanceAndContext.apply(this, arguments);
      }

      return getBalanceAndContext;
    }()
    /**
     * Fetch the balance for the specified public key
     */

  }, {
    key: "getBalance",
    value: function () {
      var _getBalance = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee3(publicKey, commitment) {
        return _regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.getBalanceAndContext(publicKey, commitment).then(function (x) {
                  return x.value;
                })["catch"](function (e) {
                  throw new Error('failed to get balance of account ' + publicKey.toBase58() + ': ' + e);
                });

              case 2:
                return _context3.abrupt("return", _context3.sent);

              case 3:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function getBalance(_x5, _x6) {
        return _getBalance.apply(this, arguments);
      }

      return getBalance;
    }()
    /**
     * Fetch the estimated production time of a block
     */

  }, {
    key: "getBlockTime",
    value: function () {
      var _getBlockTime = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee4(slot) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return this._rpcRequest('getBlockTime', [slot]);

              case 2:
                unsafeRes = _context4.sent;
                res = GetBlockTimeRpcResult(unsafeRes);

                if (!res.error) {
                  _context4.next = 6;
                  break;
                }

                throw new Error('failed to get block time for slot ' + slot + ': ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context4.abrupt("return", res.result);

              case 8:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function getBlockTime(_x7) {
        return _getBlockTime.apply(this, arguments);
      }

      return getBlockTime;
    }()
    /**
     * Fetch the lowest slot that the node has information about in its ledger.
     * This value may increase over time if the node is configured to purge older ledger data
     */

  }, {
    key: "getMinimumLedgerSlot",
    value: function () {
      var _getMinimumLedgerSlot = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee5() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this._rpcRequest('minimumLedgerSlot', []);

              case 2:
                unsafeRes = _context5.sent;
                res = SlotRpcResult(unsafeRes);

                if (!res.error) {
                  _context5.next = 6;
                  break;
                }

                throw new Error('failed to get minimum ledger slot: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context5.abrupt("return", res.result);

              case 8:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function getMinimumLedgerSlot() {
        return _getMinimumLedgerSlot.apply(this, arguments);
      }

      return getMinimumLedgerSlot;
    }()
    /**
     * Fetch the slot of the lowest confirmed block that has not been purged from the ledger
     */

  }, {
    key: "getFirstAvailableBlock",
    value: function () {
      var _getFirstAvailableBlock = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee6() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this._rpcRequest('getFirstAvailableBlock', []);

              case 2:
                unsafeRes = _context6.sent;
                res = SlotRpcResult(unsafeRes);

                if (!res.error) {
                  _context6.next = 6;
                  break;
                }

                throw new Error('failed to get first available block: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context6.abrupt("return", res.result);

              case 8:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function getFirstAvailableBlock() {
        return _getFirstAvailableBlock.apply(this, arguments);
      }

      return getFirstAvailableBlock;
    }()
    /**
     * Fetch information about the current supply
     */

  }, {
    key: "getSupply",
    value: function () {
      var _getSupply = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee7(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context7.next = 3;
                return this._rpcRequest('getSupply', args);

              case 3:
                unsafeRes = _context7.sent;
                res = GetSupplyRpcResult(unsafeRes);

                if (!res.error) {
                  _context7.next = 7;
                  break;
                }

                throw new Error('failed to get supply: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                res.result.value.nonCirculatingAccounts = res.result.value.nonCirculatingAccounts.map(function (account) {
                  return new PublicKey(account);
                });
                return _context7.abrupt("return", res.result);

              case 10:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function getSupply(_x8) {
        return _getSupply.apply(this, arguments);
      }

      return getSupply;
    }()
    /**
     * Fetch the current supply of a token mint
     */

  }, {
    key: "getTokenSupply",
    value: function () {
      var _getTokenSupply = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee8(tokenMintAddress, commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                args = this._buildArgs([tokenMintAddress.toBase58()], commitment);
                _context8.next = 3;
                return this._rpcRequest('getTokenSupply', args);

              case 3:
                unsafeRes = _context8.sent;
                res = GetTokenSupplyRpcResult(unsafeRes);

                if (!res.error) {
                  _context8.next = 7;
                  break;
                }

                throw new Error('failed to get token supply: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context8.abrupt("return", res.result);

              case 9:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function getTokenSupply(_x9, _x10) {
        return _getTokenSupply.apply(this, arguments);
      }

      return getTokenSupply;
    }()
    /**
     * Fetch the current balance of a token account
     */

  }, {
    key: "getTokenAccountBalance",
    value: function () {
      var _getTokenAccountBalance = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee9(tokenAddress, commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                args = this._buildArgs([tokenAddress.toBase58()], commitment);
                _context9.next = 3;
                return this._rpcRequest('getTokenAccountBalance', args);

              case 3:
                unsafeRes = _context9.sent;
                res = GetTokenAccountBalance(unsafeRes);

                if (!res.error) {
                  _context9.next = 7;
                  break;
                }

                throw new Error('failed to get token account balance: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context9.abrupt("return", res.result);

              case 9:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function getTokenAccountBalance(_x11, _x12) {
        return _getTokenAccountBalance.apply(this, arguments);
      }

      return getTokenAccountBalance;
    }()
    /**
     * Fetch all the token accounts owned by the specified account
     *
     * @return {Promise<RpcResponseAndContext<Array<{pubkey: PublicKey, account: AccountInfo<Buffer>}>>>}
     */

  }, {
    key: "getTokenAccountsByOwner",
    value: function () {
      var _getTokenAccountsByOwner = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee10(ownerAddress, filter, commitment) {
        var _args, args, unsafeRes, res, result, context, value;

        return _regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                _args = [ownerAddress.toBase58()];

                if (filter.mint) {
                  _args.push({
                    mint: filter.mint.toBase58()
                  });
                } else {
                  _args.push({
                    programId: filter.programId.toBase58()
                  });
                }

                args = this._buildArgs(_args, commitment, 'base64');
                _context10.next = 5;
                return this._rpcRequest('getTokenAccountsByOwner', args);

              case 5:
                unsafeRes = _context10.sent;
                res = GetTokenAccountsByOwner(unsafeRes);

                if (!res.error) {
                  _context10.next = 9;
                  break;
                }

                throw new Error('failed to get token accounts owned by account ' + ownerAddress.toBase58() + ': ' + res.error.message);

              case 9:
                result = res.result;
                context = result.context, value = result.value;
                assert(typeof result !== 'undefined');
                return _context10.abrupt("return", {
                  context: context,
                  value: value.map(function (result) {
                    assert(result.account.data[1] === 'base64');
                    return {
                      pubkey: new PublicKey(result.pubkey),
                      account: {
                        executable: result.account.executable,
                        owner: new PublicKey(result.account.owner),
                        lamports: result.account.lamports,
                        data: Buffer.from(result.account.data[0], 'base64')
                      }
                    };
                  })
                });

              case 13:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function getTokenAccountsByOwner(_x13, _x14, _x15) {
        return _getTokenAccountsByOwner.apply(this, arguments);
      }

      return getTokenAccountsByOwner;
    }()
    /**
     * Fetch parsed token accounts owned by the specified account
     *
     * @return {Promise<RpcResponseAndContext<Array<{pubkey: PublicKey, account: AccountInfo<ParsedAccountData>}>>>}
     */

  }, {
    key: "getParsedTokenAccountsByOwner",
    value: function () {
      var _getParsedTokenAccountsByOwner = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee11(ownerAddress, filter, commitment) {
        var _args, args, unsafeRes, res, result, context, value;

        return _regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                _args = [ownerAddress.toBase58()];

                if (filter.mint) {
                  _args.push({
                    mint: filter.mint.toBase58()
                  });
                } else {
                  _args.push({
                    programId: filter.programId.toBase58()
                  });
                }

                args = this._buildArgs(_args, commitment, 'jsonParsed');
                _context11.next = 5;
                return this._rpcRequest('getTokenAccountsByOwner', args);

              case 5:
                unsafeRes = _context11.sent;
                res = GetParsedTokenAccountsByOwner(unsafeRes);

                if (!res.error) {
                  _context11.next = 9;
                  break;
                }

                throw new Error('failed to get token accounts owned by account ' + ownerAddress.toBase58() + ': ' + res.error.message);

              case 9:
                result = res.result;
                context = result.context, value = result.value;
                assert(typeof result !== 'undefined');
                return _context11.abrupt("return", {
                  context: context,
                  value: value.map(function (result) {
                    return {
                      pubkey: new PublicKey(result.pubkey),
                      account: {
                        executable: result.account.executable,
                        owner: new PublicKey(result.account.owner),
                        lamports: result.account.lamports,
                        data: result.account.data
                      }
                    };
                  })
                });

              case 13:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function getParsedTokenAccountsByOwner(_x16, _x17, _x18) {
        return _getParsedTokenAccountsByOwner.apply(this, arguments);
      }

      return getParsedTokenAccountsByOwner;
    }()
    /**
     * Fetch the 20 largest accounts with their current balances
     */

  }, {
    key: "getLargestAccounts",
    value: function () {
      var _getLargestAccounts = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee12(config) {
        var arg, args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                arg = _objectSpread(_objectSpread({}, config), {}, {
                  commitment: config && config.commitment || this.commitment
                });
                args = arg.filter || arg.commitment ? [arg] : [];
                _context12.next = 4;
                return this._rpcRequest('getLargestAccounts', args);

              case 4:
                unsafeRes = _context12.sent;
                res = GetLargestAccountsRpcResult(unsafeRes);

                if (!res.error) {
                  _context12.next = 8;
                  break;
                }

                throw new Error('failed to get largest accounts: ' + res.error.message);

              case 8:
                assert(typeof res.result !== 'undefined');
                res.result.value = res.result.value.map(function (_ref2) {
                  var address = _ref2.address,
                      lamports = _ref2.lamports;
                  return {
                    address: new PublicKey(address),
                    lamports: lamports
                  };
                });
                return _context12.abrupt("return", res.result);

              case 11:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function getLargestAccounts(_x19) {
        return _getLargestAccounts.apply(this, arguments);
      }

      return getLargestAccounts;
    }()
    /**
     * Fetch the 20 largest token accounts with their current balances
     * for a given mint.
     */

  }, {
    key: "getTokenLargestAccounts",
    value: function () {
      var _getTokenLargestAccounts = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee13(mintAddress, commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                args = this._buildArgs([mintAddress.toBase58()], commitment);
                _context13.next = 3;
                return this._rpcRequest('getTokenLargestAccounts', args);

              case 3:
                unsafeRes = _context13.sent;
                res = GetTokenLargestAccountsResult(unsafeRes);

                if (!res.error) {
                  _context13.next = 7;
                  break;
                }

                throw new Error('failed to get token largest accounts: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                res.result.value = res.result.value.map(function (pair) {
                  return _objectSpread(_objectSpread({}, pair), {}, {
                    address: new PublicKey(pair.address)
                  });
                });
                return _context13.abrupt("return", res.result);

              case 10:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function getTokenLargestAccounts(_x20, _x21) {
        return _getTokenLargestAccounts.apply(this, arguments);
      }

      return getTokenLargestAccounts;
    }()
    /**
     * Fetch all the account info for the specified public key, return with context
     */

  }, {
    key: "getAccountInfoAndContext",
    value: function () {
      var _getAccountInfoAndContext = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee14(publicKey, commitment) {
        var args, unsafeRes, res, value, _res$result$value, executable, owner, lamports, data;

        return _regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                args = this._buildArgs([publicKey.toBase58()], commitment, 'base64');
                _context14.next = 3;
                return this._rpcRequest('getAccountInfo', args);

              case 3:
                unsafeRes = _context14.sent;
                res = GetAccountInfoAndContextRpcResult(unsafeRes);

                if (!res.error) {
                  _context14.next = 7;
                  break;
                }

                throw new Error('failed to get info about account ' + publicKey.toBase58() + ': ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                value = null;

                if (res.result.value) {
                  _res$result$value = res.result.value, executable = _res$result$value.executable, owner = _res$result$value.owner, lamports = _res$result$value.lamports, data = _res$result$value.data;
                  assert(data[1] === 'base64');
                  value = {
                    executable: executable,
                    owner: new PublicKey(owner),
                    lamports: lamports,
                    data: Buffer.from(data[0], 'base64')
                  };
                }

                return _context14.abrupt("return", {
                  context: {
                    slot: res.result.context.slot
                  },
                  value: value
                });

              case 11:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function getAccountInfoAndContext(_x22, _x23) {
        return _getAccountInfoAndContext.apply(this, arguments);
      }

      return getAccountInfoAndContext;
    }()
    /**
     * Fetch parsed account info for the specified public key
     */

  }, {
    key: "getParsedAccountInfo",
    value: function () {
      var _getParsedAccountInfo = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee15(publicKey, commitment) {
        var args, unsafeRes, res, value, _res$result$value2, executable, owner, lamports, resultData, data;

        return _regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                args = this._buildArgs([publicKey.toBase58()], commitment, 'jsonParsed');
                _context15.next = 3;
                return this._rpcRequest('getAccountInfo', args);

              case 3:
                unsafeRes = _context15.sent;
                res = GetParsedAccountInfoResult(unsafeRes);

                if (!res.error) {
                  _context15.next = 7;
                  break;
                }

                throw new Error('failed to get info about account ' + publicKey.toBase58() + ': ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                value = null;

                if (res.result.value) {
                  _res$result$value2 = res.result.value, executable = _res$result$value2.executable, owner = _res$result$value2.owner, lamports = _res$result$value2.lamports, resultData = _res$result$value2.data;
                  data = resultData;

                  if (!data.program) {
                    assert(data[1] === 'base64');
                    data = Buffer.from(data[0], 'base64');
                  }

                  value = {
                    executable: executable,
                    owner: new PublicKey(owner),
                    lamports: lamports,
                    data: data
                  };
                }

                return _context15.abrupt("return", {
                  context: {
                    slot: res.result.context.slot
                  },
                  value: value
                });

              case 11:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function getParsedAccountInfo(_x24, _x25) {
        return _getParsedAccountInfo.apply(this, arguments);
      }

      return getParsedAccountInfo;
    }()
    /**
     * Fetch all the account info for the specified public key
     */

  }, {
    key: "getAccountInfo",
    value: function () {
      var _getAccountInfo = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee16(publicKey, commitment) {
        return _regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                _context16.next = 2;
                return this.getAccountInfoAndContext(publicKey, commitment).then(function (x) {
                  return x.value;
                })["catch"](function (e) {
                  throw new Error('failed to get info about account ' + publicKey.toBase58() + ': ' + e);
                });

              case 2:
                return _context16.abrupt("return", _context16.sent);

              case 3:
              case "end":
                return _context16.stop();
            }
          }
        }, _callee16, this);
      }));

      function getAccountInfo(_x26, _x27) {
        return _getAccountInfo.apply(this, arguments);
      }

      return getAccountInfo;
    }()
    /**
     * Fetch all the accounts owned by the specified program id
     *
     * @return {Promise<Array<{pubkey: PublicKey, account: AccountInfo<Buffer>}>>}
     */

  }, {
    key: "getProgramAccounts",
    value: function () {
      var _getProgramAccounts = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee17(programId, commitment) {
        var args, unsafeRes, res, result;
        return _regeneratorRuntime.wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                args = this._buildArgs([programId.toBase58()], commitment, 'base64');
                _context17.next = 3;
                return this._rpcRequest('getProgramAccounts', args);

              case 3:
                unsafeRes = _context17.sent;
                res = GetProgramAccountsRpcResult(unsafeRes);

                if (!res.error) {
                  _context17.next = 7;
                  break;
                }

                throw new Error('failed to get accounts owned by program ' + programId.toBase58() + ': ' + res.error.message);

              case 7:
                result = res.result;
                assert(typeof result !== 'undefined');
                return _context17.abrupt("return", result.map(function (result) {
                  assert(result.account.data[1] === 'base64');
                  return {
                    pubkey: new PublicKey(result.pubkey),
                    account: {
                      executable: result.account.executable,
                      owner: new PublicKey(result.account.owner),
                      lamports: result.account.lamports,
                      data: Buffer.from(result.account.data[0], 'base64')
                    }
                  };
                }));

              case 10:
              case "end":
                return _context17.stop();
            }
          }
        }, _callee17, this);
      }));

      function getProgramAccounts(_x28, _x29) {
        return _getProgramAccounts.apply(this, arguments);
      }

      return getProgramAccounts;
    }()
    /**
     * Fetch and parse all the accounts owned by the specified program id
     *
     * @return {Promise<Array<{pubkey: PublicKey, account: AccountInfo<Buffer | ParsedAccountData>}>>}
     */

  }, {
    key: "getParsedProgramAccounts",
    value: function () {
      var _getParsedProgramAccounts = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee18(programId, commitment) {
        var args, unsafeRes, res, result;
        return _regeneratorRuntime.wrap(function _callee18$(_context18) {
          while (1) {
            switch (_context18.prev = _context18.next) {
              case 0:
                args = this._buildArgs([programId.toBase58()], commitment, 'jsonParsed');
                _context18.next = 3;
                return this._rpcRequest('getProgramAccounts', args);

              case 3:
                unsafeRes = _context18.sent;
                res = GetParsedProgramAccountsRpcResult(unsafeRes);

                if (!res.error) {
                  _context18.next = 7;
                  break;
                }

                throw new Error('failed to get accounts owned by program ' + programId.toBase58() + ': ' + res.error.message);

              case 7:
                result = res.result;
                assert(typeof result !== 'undefined');
                return _context18.abrupt("return", result.map(function (result) {
                  var resultData = result.account.data;
                  var data = resultData;

                  if (!data.program) {
                    assert(data[1] === 'base64');
                    data = Buffer.from(data[0], 'base64');
                  }

                  return {
                    pubkey: new PublicKey(result.pubkey),
                    account: {
                      executable: result.account.executable,
                      owner: new PublicKey(result.account.owner),
                      lamports: result.account.lamports,
                      data: data
                    }
                  };
                }));

              case 10:
              case "end":
                return _context18.stop();
            }
          }
        }, _callee18, this);
      }));

      function getParsedProgramAccounts(_x30, _x31) {
        return _getParsedProgramAccounts.apply(this, arguments);
      }

      return getParsedProgramAccounts;
    }()
    /**
     * Confirm the transaction identified by the specified signature
     */

  }, {
    key: "confirmTransaction",
    value: function () {
      var _confirmTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee19(signature, confirmations) {
        var start, WAIT_TIMEOUT_MS, statusResponse, status;
        return _regeneratorRuntime.wrap(function _callee19$(_context19) {
          while (1) {
            switch (_context19.prev = _context19.next) {
              case 0:
                start = Date.now();
                WAIT_TIMEOUT_MS = 60 * 1000;
                _context19.next = 4;
                return this.getSignatureStatus(signature);

              case 4:
                statusResponse = _context19.sent;

              case 5:
                status = statusResponse.value;

                if (!status) {
                  _context19.next = 11;
                  break;
                }

                if (!(status.err || status.confirmations === null || typeof confirmations === 'number' && status.confirmations >= confirmations)) {
                  _context19.next = 9;
                  break;
                }

                return _context19.abrupt("break", 20);

              case 9:
                _context19.next = 13;
                break;

              case 11:
                if (!(Date.now() - start >= WAIT_TIMEOUT_MS)) {
                  _context19.next = 13;
                  break;
                }

                return _context19.abrupt("break", 20);

              case 13:
                _context19.next = 15;
                return sleep(MS_PER_SLOT);

              case 15:
                _context19.next = 17;
                return this.getSignatureStatus(signature);

              case 17:
                statusResponse = _context19.sent;

              case 18:
                _context19.next = 5;
                break;

              case 20:
                return _context19.abrupt("return", statusResponse);

              case 21:
              case "end":
                return _context19.stop();
            }
          }
        }, _callee19, this);
      }));

      function confirmTransaction(_x32, _x33) {
        return _confirmTransaction.apply(this, arguments);
      }

      return confirmTransaction;
    }()
    /**
     * Return the list of nodes that are currently participating in the cluster
     */

  }, {
    key: "getClusterNodes",
    value: function () {
      var _getClusterNodes = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee20() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee20$(_context20) {
          while (1) {
            switch (_context20.prev = _context20.next) {
              case 0:
                _context20.next = 2;
                return this._rpcRequest('getClusterNodes', []);

              case 2:
                unsafeRes = _context20.sent;
                res = GetClusterNodes(unsafeRes);

                if (!res.error) {
                  _context20.next = 6;
                  break;
                }

                throw new Error('failed to get cluster nodes: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context20.abrupt("return", res.result);

              case 8:
              case "end":
                return _context20.stop();
            }
          }
        }, _callee20, this);
      }));

      function getClusterNodes() {
        return _getClusterNodes.apply(this, arguments);
      }

      return getClusterNodes;
    }()
    /**
     * Return the list of nodes that are currently participating in the cluster
     */

  }, {
    key: "getVoteAccounts",
    value: function () {
      var _getVoteAccounts = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee21(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee21$(_context21) {
          while (1) {
            switch (_context21.prev = _context21.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context21.next = 3;
                return this._rpcRequest('getVoteAccounts', args);

              case 3:
                unsafeRes = _context21.sent;
                res = GetVoteAccounts(unsafeRes); //const res = unsafeRes;

                if (!res.error) {
                  _context21.next = 7;
                  break;
                }

                throw new Error('failed to get vote accounts: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context21.abrupt("return", res.result);

              case 9:
              case "end":
                return _context21.stop();
            }
          }
        }, _callee21, this);
      }));

      function getVoteAccounts(_x34) {
        return _getVoteAccounts.apply(this, arguments);
      }

      return getVoteAccounts;
    }()
    /**
     * Fetch the current slot that the node is processing
     */

  }, {
    key: "getSlot",
    value: function () {
      var _getSlot = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee22(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee22$(_context22) {
          while (1) {
            switch (_context22.prev = _context22.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context22.next = 3;
                return this._rpcRequest('getSlot', args);

              case 3:
                unsafeRes = _context22.sent;
                res = GetSlot(unsafeRes);

                if (!res.error) {
                  _context22.next = 7;
                  break;
                }

                throw new Error('failed to get slot: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context22.abrupt("return", res.result);

              case 9:
              case "end":
                return _context22.stop();
            }
          }
        }, _callee22, this);
      }));

      function getSlot(_x35) {
        return _getSlot.apply(this, arguments);
      }

      return getSlot;
    }()
    /**
     * Fetch the current slot leader of the cluster
     */

  }, {
    key: "getSlotLeader",
    value: function () {
      var _getSlotLeader = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee23(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee23$(_context23) {
          while (1) {
            switch (_context23.prev = _context23.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context23.next = 3;
                return this._rpcRequest('getSlotLeader', args);

              case 3:
                unsafeRes = _context23.sent;
                res = GetSlotLeader(unsafeRes);

                if (!res.error) {
                  _context23.next = 7;
                  break;
                }

                throw new Error('failed to get slot leader: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context23.abrupt("return", res.result);

              case 9:
              case "end":
                return _context23.stop();
            }
          }
        }, _callee23, this);
      }));

      function getSlotLeader(_x36) {
        return _getSlotLeader.apply(this, arguments);
      }

      return getSlotLeader;
    }()
    /**
     * Fetch the current status of a signature
     */

  }, {
    key: "getSignatureStatus",
    value: function () {
      var _getSignatureStatus = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee24(signature, config) {
        var _yield$this$getSignat, context, value;

        return _regeneratorRuntime.wrap(function _callee24$(_context24) {
          while (1) {
            switch (_context24.prev = _context24.next) {
              case 0:
                _context24.next = 2;
                return this.getSignatureStatuses([signature], config);

              case 2:
                _yield$this$getSignat = _context24.sent;
                context = _yield$this$getSignat.context;
                value = _yield$this$getSignat.value;
                assert(value.length === 1);
                return _context24.abrupt("return", {
                  context: context,
                  value: value[0]
                });

              case 7:
              case "end":
                return _context24.stop();
            }
          }
        }, _callee24, this);
      }));

      function getSignatureStatus(_x37, _x38) {
        return _getSignatureStatus.apply(this, arguments);
      }

      return getSignatureStatus;
    }()
    /**
     * Fetch the current statuses of a batch of signatures
     */

  }, {
    key: "getSignatureStatuses",
    value: function () {
      var _getSignatureStatuses = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee25(signatures, config) {
        var params, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee25$(_context25) {
          while (1) {
            switch (_context25.prev = _context25.next) {
              case 0:
                params = [signatures];

                if (config) {
                  params.push(config);
                }

                _context25.next = 4;
                return this._rpcRequest('getSignatureStatuses', params);

              case 4:
                unsafeRes = _context25.sent;
                res = GetSignatureStatusesRpcResult(unsafeRes);

                if (!res.error) {
                  _context25.next = 8;
                  break;
                }

                throw new Error('failed to get signature status: ' + res.error.message);

              case 8:
                assert(typeof res.result !== 'undefined');
                return _context25.abrupt("return", res.result);

              case 10:
              case "end":
                return _context25.stop();
            }
          }
        }, _callee25, this);
      }));

      function getSignatureStatuses(_x39, _x40) {
        return _getSignatureStatuses.apply(this, arguments);
      }

      return getSignatureStatuses;
    }()
    /**
     * Fetch the current transaction count of the cluster
     */

  }, {
    key: "getTransactionCount",
    value: function () {
      var _getTransactionCount = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee26(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee26$(_context26) {
          while (1) {
            switch (_context26.prev = _context26.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context26.next = 3;
                return this._rpcRequest('getTransactionCount', args);

              case 3:
                unsafeRes = _context26.sent;
                res = GetTransactionCountRpcResult(unsafeRes);

                if (!res.error) {
                  _context26.next = 7;
                  break;
                }

                throw new Error('failed to get transaction count: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context26.abrupt("return", Number(res.result));

              case 9:
              case "end":
                return _context26.stop();
            }
          }
        }, _callee26, this);
      }));

      function getTransactionCount(_x41) {
        return _getTransactionCount.apply(this, arguments);
      }

      return getTransactionCount;
    }()
    /**
     * Fetch the current total currency supply of the cluster in lamports
     */

  }, {
    key: "getTotalSupply",
    value: function () {
      var _getTotalSupply = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee27(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee27$(_context27) {
          while (1) {
            switch (_context27.prev = _context27.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context27.next = 3;
                return this._rpcRequest('getTotalSupply', args);

              case 3:
                unsafeRes = _context27.sent;
                res = GetTotalSupplyRpcResult(unsafeRes);

                if (!res.error) {
                  _context27.next = 7;
                  break;
                }

                throw new Error('faied to get total supply: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context27.abrupt("return", Number(res.result));

              case 9:
              case "end":
                return _context27.stop();
            }
          }
        }, _callee27, this);
      }));

      function getTotalSupply(_x42) {
        return _getTotalSupply.apply(this, arguments);
      }

      return getTotalSupply;
    }()
    /**
     * Fetch the cluster InflationGovernor parameters
     */

  }, {
    key: "getInflationGovernor",
    value: function () {
      var _getInflationGovernor = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee28(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee28$(_context28) {
          while (1) {
            switch (_context28.prev = _context28.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context28.next = 3;
                return this._rpcRequest('getInflationGovernor', args);

              case 3:
                unsafeRes = _context28.sent;
                res = GetInflationGovernorRpcResult(unsafeRes);

                if (!res.error) {
                  _context28.next = 7;
                  break;
                }

                throw new Error('failed to get inflation: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context28.abrupt("return", GetInflationGovernorResult(res.result));

              case 9:
              case "end":
                return _context28.stop();
            }
          }
        }, _callee28, this);
      }));

      function getInflationGovernor(_x43) {
        return _getInflationGovernor.apply(this, arguments);
      }

      return getInflationGovernor;
    }()
    /**
     * Fetch the Epoch Info parameters
     */

  }, {
    key: "getEpochInfo",
    value: function () {
      var _getEpochInfo = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee29(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee29$(_context29) {
          while (1) {
            switch (_context29.prev = _context29.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context29.next = 3;
                return this._rpcRequest('getEpochInfo', args);

              case 3:
                unsafeRes = _context29.sent;
                res = GetEpochInfoRpcResult(unsafeRes);

                if (!res.error) {
                  _context29.next = 7;
                  break;
                }

                throw new Error('failed to get epoch info: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context29.abrupt("return", GetEpochInfoResult(res.result));

              case 9:
              case "end":
                return _context29.stop();
            }
          }
        }, _callee29, this);
      }));

      function getEpochInfo(_x44) {
        return _getEpochInfo.apply(this, arguments);
      }

      return getEpochInfo;
    }()
    /**
     * Fetch the Epoch Schedule parameters
     */

  }, {
    key: "getEpochSchedule",
    value: function () {
      var _getEpochSchedule = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee30() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee30$(_context30) {
          while (1) {
            switch (_context30.prev = _context30.next) {
              case 0:
                _context30.next = 2;
                return this._rpcRequest('getEpochSchedule', []);

              case 2:
                unsafeRes = _context30.sent;
                res = GetEpochScheduleRpcResult(unsafeRes);

                if (!res.error) {
                  _context30.next = 6;
                  break;
                }

                throw new Error('failed to get epoch schedule: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context30.abrupt("return", GetEpochScheduleResult(res.result));

              case 8:
              case "end":
                return _context30.stop();
            }
          }
        }, _callee30, this);
      }));

      function getEpochSchedule() {
        return _getEpochSchedule.apply(this, arguments);
      }

      return getEpochSchedule;
    }()
    /**
     * Fetch the leader schedule for the current epoch
     * @return {Promise<RpcResponseAndContext<LeaderSchedule>>}
     */

  }, {
    key: "getLeaderSchedule",
    value: function () {
      var _getLeaderSchedule = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee31() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee31$(_context31) {
          while (1) {
            switch (_context31.prev = _context31.next) {
              case 0:
                _context31.next = 2;
                return this._rpcRequest('getLeaderSchedule', []);

              case 2:
                unsafeRes = _context31.sent;
                res = GetLeaderScheduleRpcResult(unsafeRes);

                if (!res.error) {
                  _context31.next = 6;
                  break;
                }

                throw new Error('failed to get leader schedule: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context31.abrupt("return", res.result);

              case 8:
              case "end":
                return _context31.stop();
            }
          }
        }, _callee31, this);
      }));

      function getLeaderSchedule() {
        return _getLeaderSchedule.apply(this, arguments);
      }

      return getLeaderSchedule;
    }()
    /**
     * Fetch the minimum balance needed to exempt an account of `dataLength`
     * size from rent
     */

  }, {
    key: "getMinimumBalanceForRentExemption",
    value: function () {
      var _getMinimumBalanceForRentExemption = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee32(dataLength, commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee32$(_context32) {
          while (1) {
            switch (_context32.prev = _context32.next) {
              case 0:
                args = this._buildArgs([dataLength], commitment);
                _context32.next = 3;
                return this._rpcRequest('getMinimumBalanceForRentExemption', args);

              case 3:
                unsafeRes = _context32.sent;
                res = GetMinimumBalanceForRentExemptionRpcResult(unsafeRes);

                if (!res.error) {
                  _context32.next = 8;
                  break;
                }

                console.warn('Unable to fetch minimum balance for rent exemption');
                return _context32.abrupt("return", 0);

              case 8:
                assert(typeof res.result !== 'undefined');
                return _context32.abrupt("return", Number(res.result));

              case 10:
              case "end":
                return _context32.stop();
            }
          }
        }, _callee32, this);
      }));

      function getMinimumBalanceForRentExemption(_x45, _x46) {
        return _getMinimumBalanceForRentExemption.apply(this, arguments);
      }

      return getMinimumBalanceForRentExemption;
    }()
    /**
     * Fetch a recent blockhash from the cluster, return with context
     * @return {Promise<RpcResponseAndContext<{blockhash: Blockhash, feeCalculator: FeeCalculator}>>}
     */

  }, {
    key: "getRecentBlockhashAndContext",
    value: function () {
      var _getRecentBlockhashAndContext = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee33(commitment) {
        var args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee33$(_context33) {
          while (1) {
            switch (_context33.prev = _context33.next) {
              case 0:
                args = this._buildArgs([], commitment);
                _context33.next = 3;
                return this._rpcRequest('getRecentBlockhash', args);

              case 3:
                unsafeRes = _context33.sent;
                res = GetRecentBlockhashAndContextRpcResult(unsafeRes);

                if (!res.error) {
                  _context33.next = 7;
                  break;
                }

                throw new Error('failed to get recent blockhash: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                return _context33.abrupt("return", res.result);

              case 9:
              case "end":
                return _context33.stop();
            }
          }
        }, _callee33, this);
      }));

      function getRecentBlockhashAndContext(_x47) {
        return _getRecentBlockhashAndContext.apply(this, arguments);
      }

      return getRecentBlockhashAndContext;
    }()
    /**
     * Fetch the fee calculator for a recent blockhash from the cluster, return with context
     */

  }, {
    key: "getFeeCalculatorForBlockhash",
    value: function () {
      var _getFeeCalculatorForBlockhash = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee34(blockhash, commitment) {
        var args, unsafeRes, res, _res$result, context, value;

        return _regeneratorRuntime.wrap(function _callee34$(_context34) {
          while (1) {
            switch (_context34.prev = _context34.next) {
              case 0:
                args = this._buildArgs([blockhash], commitment);
                _context34.next = 3;
                return this._rpcRequest('getFeeCalculatorForBlockhash', args);

              case 3:
                unsafeRes = _context34.sent;
                res = GetFeeCalculatorRpcResult(unsafeRes);

                if (!res.error) {
                  _context34.next = 7;
                  break;
                }

                throw new Error('failed to get fee calculator: ' + res.error.message);

              case 7:
                assert(typeof res.result !== 'undefined');
                _res$result = res.result, context = _res$result.context, value = _res$result.value;
                return _context34.abrupt("return", {
                  context: context,
                  value: value && value.feeCalculator
                });

              case 10:
              case "end":
                return _context34.stop();
            }
          }
        }, _callee34, this);
      }));

      function getFeeCalculatorForBlockhash(_x48, _x49) {
        return _getFeeCalculatorForBlockhash.apply(this, arguments);
      }

      return getFeeCalculatorForBlockhash;
    }()
    /**
     * Fetch a recent blockhash from the cluster
     * @return {Promise<{blockhash: Blockhash, feeCalculator: FeeCalculator}>}
     */

  }, {
    key: "getRecentBlockhash",
    value: function () {
      var _getRecentBlockhash = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee35(commitment) {
        return _regeneratorRuntime.wrap(function _callee35$(_context35) {
          while (1) {
            switch (_context35.prev = _context35.next) {
              case 0:
                _context35.next = 2;
                return this.getRecentBlockhashAndContext(commitment).then(function (x) {
                  return x.value;
                })["catch"](function (e) {
                  throw new Error('failed to get recent blockhash: ' + e);
                });

              case 2:
                return _context35.abrupt("return", _context35.sent);

              case 3:
              case "end":
                return _context35.stop();
            }
          }
        }, _callee35, this);
      }));

      function getRecentBlockhash(_x50) {
        return _getRecentBlockhash.apply(this, arguments);
      }

      return getRecentBlockhash;
    }()
    /**
     * Fetch the node version
     */

  }, {
    key: "getVersion",
    value: function () {
      var _getVersion = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee36() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee36$(_context36) {
          while (1) {
            switch (_context36.prev = _context36.next) {
              case 0:
                _context36.next = 2;
                return this._rpcRequest('getVersion', []);

              case 2:
                unsafeRes = _context36.sent;
                res = GetVersionRpcResult(unsafeRes);

                if (!res.error) {
                  _context36.next = 6;
                  break;
                }

                throw new Error('failed to get version: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context36.abrupt("return", res.result);

              case 8:
              case "end":
                return _context36.stop();
            }
          }
        }, _callee36, this);
      }));

      function getVersion() {
        return _getVersion.apply(this, arguments);
      }

      return getVersion;
    }()
    /**
     * Fetch a list of Transactions and transaction statuses from the cluster
     * for a confirmed block
     */

  }, {
    key: "getConfirmedBlock",
    value: function () {
      var _getConfirmedBlock = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee37(slot) {
        var unsafeRes, _GetConfirmedBlockRpc, result, error;

        return _regeneratorRuntime.wrap(function _callee37$(_context37) {
          while (1) {
            switch (_context37.prev = _context37.next) {
              case 0:
                _context37.next = 2;
                return this._rpcRequest('getConfirmedBlock', [slot]);

              case 2:
                unsafeRes = _context37.sent;
                _GetConfirmedBlockRpc = GetConfirmedBlockRpcResult(unsafeRes), result = _GetConfirmedBlockRpc.result, error = _GetConfirmedBlockRpc.error;

                if (!error) {
                  _context37.next = 6;
                  break;
                }

                throw new Error('failed to get confirmed block: ' + result.error.message);

              case 6:
                assert(typeof result !== 'undefined');

                if (result) {
                  _context37.next = 9;
                  break;
                }

                throw new Error('Confirmed block ' + slot + ' not found');

              case 9:
                return _context37.abrupt("return", {
                  blockhash: new PublicKey(result.blockhash).toString(),
                  previousBlockhash: new PublicKey(result.previousBlockhash).toString(),
                  parentSlot: result.parentSlot,
                  transactions: result.transactions.map(function (result) {
                    var _result$transaction = result.transaction,
                        message = _result$transaction.message,
                        signatures = _result$transaction.signatures;
                    return {
                      transaction: Transaction.populate(new Message(message), signatures),
                      meta: result.meta
                    };
                  }),
                  rewards: result.rewards || []
                });

              case 10:
              case "end":
                return _context37.stop();
            }
          }
        }, _callee37, this);
      }));

      function getConfirmedBlock(_x51) {
        return _getConfirmedBlock.apply(this, arguments);
      }

      return getConfirmedBlock;
    }()
    /**
     * Fetch a transaction details for a confirmed transaction
     */

  }, {
    key: "getConfirmedTransaction",
    value: function () {
      var _getConfirmedTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee38(signature) {
        var unsafeRes, _GetConfirmedTransact, result, error, _result$transaction2, message, signatures;

        return _regeneratorRuntime.wrap(function _callee38$(_context38) {
          while (1) {
            switch (_context38.prev = _context38.next) {
              case 0:
                _context38.next = 2;
                return this._rpcRequest('getConfirmedTransaction', [signature]);

              case 2:
                unsafeRes = _context38.sent;
                _GetConfirmedTransact = GetConfirmedTransactionRpcResult(unsafeRes), result = _GetConfirmedTransact.result, error = _GetConfirmedTransact.error;

                if (!error) {
                  _context38.next = 6;
                  break;
                }

                throw new Error('failed to get confirmed transaction: ' + error.message);

              case 6:
                assert(typeof result !== 'undefined');

                if (!(result === null)) {
                  _context38.next = 9;
                  break;
                }

                return _context38.abrupt("return", result);

              case 9:
                _result$transaction2 = result.transaction, message = _result$transaction2.message, signatures = _result$transaction2.signatures;
                return _context38.abrupt("return", {
                  slot: result.slot,
                  transaction: Transaction.populate(new Message(message), signatures),
                  meta: result.meta
                });

              case 11:
              case "end":
                return _context38.stop();
            }
          }
        }, _callee38, this);
      }));

      function getConfirmedTransaction(_x52) {
        return _getConfirmedTransaction.apply(this, arguments);
      }

      return getConfirmedTransaction;
    }()
    /**
     * Fetch parsed transaction details for a confirmed transaction
     */

  }, {
    key: "getParsedConfirmedTransaction",
    value: function () {
      var _getParsedConfirmedTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee39(signature) {
        var unsafeRes, _GetParsedConfirmedTr, result, error, _result$transaction$m, accountKeys, instructions, recentBlockhash;

        return _regeneratorRuntime.wrap(function _callee39$(_context39) {
          while (1) {
            switch (_context39.prev = _context39.next) {
              case 0:
                _context39.next = 2;
                return this._rpcRequest('getConfirmedTransaction', [signature, 'jsonParsed']);

              case 2:
                unsafeRes = _context39.sent;
                _GetParsedConfirmedTr = GetParsedConfirmedTransactionRpcResult(unsafeRes), result = _GetParsedConfirmedTr.result, error = _GetParsedConfirmedTr.error;

                if (!error) {
                  _context39.next = 6;
                  break;
                }

                throw new Error('failed to get confirmed transaction: ' + error.message);

              case 6:
                assert(typeof result !== 'undefined');

                if (!(result === null)) {
                  _context39.next = 9;
                  break;
                }

                return _context39.abrupt("return", result);

              case 9:
                _result$transaction$m = result.transaction.message, accountKeys = _result$transaction$m.accountKeys, instructions = _result$transaction$m.instructions, recentBlockhash = _result$transaction$m.recentBlockhash;
                return _context39.abrupt("return", {
                  slot: result.slot,
                  meta: result.meta,
                  transaction: {
                    signatures: result.transaction.signatures,
                    message: {
                      accountKeys: accountKeys.map(function (accountKey) {
                        return {
                          pubkey: new PublicKey(accountKey.pubkey),
                          signer: accountKey.signer,
                          writable: accountKey.writable
                        };
                      }),
                      instructions: instructions.map(function (ix) {
                        var mapped = {
                          programId: new PublicKey(ix.programId)
                        };

                        if ('accounts' in ix) {
                          mapped.accounts = ix.accounts.map(function (key) {
                            return new PublicKey(key);
                          });
                        }

                        return _objectSpread(_objectSpread({}, ix), mapped);
                      }),
                      recentBlockhash: recentBlockhash
                    }
                  }
                });

              case 11:
              case "end":
                return _context39.stop();
            }
          }
        }, _callee39, this);
      }));

      function getParsedConfirmedTransaction(_x53) {
        return _getParsedConfirmedTransaction.apply(this, arguments);
      }

      return getParsedConfirmedTransaction;
    }()
    /**
     * Fetch a list of all the confirmed signatures for transactions involving an address
     * within a specified slot range. Max range allowed is 10,000 slots.
     *
     * @param address queried address
     * @param startSlot start slot, inclusive
     * @param endSlot end slot, inclusive
     */

  }, {
    key: "getConfirmedSignaturesForAddress",
    value: function () {
      var _getConfirmedSignaturesForAddress = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee40(address, startSlot, endSlot) {
        var unsafeRes, result;
        return _regeneratorRuntime.wrap(function _callee40$(_context40) {
          while (1) {
            switch (_context40.prev = _context40.next) {
              case 0:
                _context40.next = 2;
                return this._rpcRequest('getConfirmedSignaturesForAddress', [address.toBase58(), startSlot, endSlot]);

              case 2:
                unsafeRes = _context40.sent;
                result = GetConfirmedSignaturesForAddressRpcResult(unsafeRes);

                if (!result.error) {
                  _context40.next = 6;
                  break;
                }

                throw new Error('failed to get confirmed signatures for address: ' + result.error.message);

              case 6:
                assert(typeof result.result !== 'undefined');
                return _context40.abrupt("return", result.result);

              case 8:
              case "end":
                return _context40.stop();
            }
          }
        }, _callee40, this);
      }));

      function getConfirmedSignaturesForAddress(_x54, _x55, _x56) {
        return _getConfirmedSignaturesForAddress.apply(this, arguments);
      }

      return getConfirmedSignaturesForAddress;
    }()
    /**
     * Returns confirmed signatures for transactions involving an
     * address backwards in time from the provided signature or most recent confirmed block
     *
     *
     * @param address queried address
     * @param options
     */

  }, {
    key: "getConfirmedSignaturesForAddress2",
    value: function () {
      var _getConfirmedSignaturesForAddress2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee41(address, options) {
        var unsafeRes, result;
        return _regeneratorRuntime.wrap(function _callee41$(_context41) {
          while (1) {
            switch (_context41.prev = _context41.next) {
              case 0:
                _context41.next = 2;
                return this._rpcRequest('getConfirmedSignaturesForAddress2', [address.toBase58(), options]);

              case 2:
                unsafeRes = _context41.sent;
                result = GetConfirmedSignaturesForAddress2RpcResult(unsafeRes);

                if (!result.error) {
                  _context41.next = 6;
                  break;
                }

                throw new Error('failed to get confirmed signatures for address: ' + result.error.message);

              case 6:
                assert(typeof result.result !== 'undefined');
                return _context41.abrupt("return", result.result);

              case 8:
              case "end":
                return _context41.stop();
            }
          }
        }, _callee41, this);
      }));

      function getConfirmedSignaturesForAddress2(_x57, _x58) {
        return _getConfirmedSignaturesForAddress2.apply(this, arguments);
      }

      return getConfirmedSignaturesForAddress2;
    }()
    /**
     * Fetch the contents of a Nonce account from the cluster, return with context
     */

  }, {
    key: "getNonceAndContext",
    value: function () {
      var _getNonceAndContext = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee42(nonceAccount, commitment) {
        var _yield$this$getAccoun, context, accountInfo, value;

        return _regeneratorRuntime.wrap(function _callee42$(_context42) {
          while (1) {
            switch (_context42.prev = _context42.next) {
              case 0:
                _context42.next = 2;
                return this.getAccountInfoAndContext(nonceAccount, commitment);

              case 2:
                _yield$this$getAccoun = _context42.sent;
                context = _yield$this$getAccoun.context;
                accountInfo = _yield$this$getAccoun.value;
                value = null;

                if (accountInfo !== null) {
                  value = NonceAccount.fromAccountData(accountInfo.data);
                }

                return _context42.abrupt("return", {
                  context: context,
                  value: value
                });

              case 8:
              case "end":
                return _context42.stop();
            }
          }
        }, _callee42, this);
      }));

      function getNonceAndContext(_x59, _x60) {
        return _getNonceAndContext.apply(this, arguments);
      }

      return getNonceAndContext;
    }()
    /**
     * Fetch the contents of a Nonce account from the cluster
     */

  }, {
    key: "getNonce",
    value: function () {
      var _getNonce = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee43(nonceAccount, commitment) {
        return _regeneratorRuntime.wrap(function _callee43$(_context43) {
          while (1) {
            switch (_context43.prev = _context43.next) {
              case 0:
                _context43.next = 2;
                return this.getNonceAndContext(nonceAccount, commitment).then(function (x) {
                  return x.value;
                })["catch"](function (e) {
                  throw new Error('failed to get nonce for account ' + nonceAccount.toBase58() + ': ' + e);
                });

              case 2:
                return _context43.abrupt("return", _context43.sent);

              case 3:
              case "end":
                return _context43.stop();
            }
          }
        }, _callee43, this);
      }));

      function getNonce(_x61, _x62) {
        return _getNonce.apply(this, arguments);
      }

      return getNonce;
    }()
    /**
     * Request an allocation of lamports to the specified account
     */

  }, {
    key: "requestAirdrop",
    value: function () {
      var _requestAirdrop = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee44(to, amount) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee44$(_context44) {
          while (1) {
            switch (_context44.prev = _context44.next) {
              case 0:
                _context44.next = 2;
                return this._rpcRequest('requestAirdrop', [to.toBase58(), amount]);

              case 2:
                unsafeRes = _context44.sent;
                res = RequestAirdropRpcResult(unsafeRes);

                if (!res.error) {
                  _context44.next = 6;
                  break;
                }

                throw new Error('airdrop to ' + to.toBase58() + ' failed: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context44.abrupt("return", res.result);

              case 8:
              case "end":
                return _context44.stop();
            }
          }
        }, _callee44, this);
      }));

      function requestAirdrop(_x63, _x64) {
        return _requestAirdrop.apply(this, arguments);
      }

      return requestAirdrop;
    }()
  }, {
    key: "_recentBlockhash",
    value: function () {
      var _recentBlockhash2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee45(disableCache) {
        var expired;
        return _regeneratorRuntime.wrap(function _callee45$(_context45) {
          while (1) {
            switch (_context45.prev = _context45.next) {
              case 0:
                if (disableCache) {
                  _context45.next = 4;
                  break;
                }

                // Attempt to use a recent blockhash for up to 30 seconds
                expired = Date.now() - this._blockhashInfo.lastFetch >= BLOCKHASH_CACHE_TIMEOUT_MS;

                if (!(this._blockhashInfo.recentBlockhash !== null && !expired)) {
                  _context45.next = 4;
                  break;
                }

                return _context45.abrupt("return", this._blockhashInfo.recentBlockhash);

              case 4:
                _context45.next = 6;
                return this._pollNewBlockhash();

              case 6:
                return _context45.abrupt("return", _context45.sent);

              case 7:
              case "end":
                return _context45.stop();
            }
          }
        }, _callee45, this);
      }));

      function _recentBlockhash(_x65) {
        return _recentBlockhash2.apply(this, arguments);
      }

      return _recentBlockhash;
    }()
  }, {
    key: "_pollNewBlockhash",
    value: function () {
      var _pollNewBlockhash2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee46() {
        var startTime, i, _yield$this$getRecent, blockhash;

        return _regeneratorRuntime.wrap(function _callee46$(_context46) {
          while (1) {
            switch (_context46.prev = _context46.next) {
              case 0:
                startTime = Date.now();
                i = 0;

              case 2:
                if (!(i < 50)) {
                  _context46.next = 15;
                  break;
                }

                _context46.next = 5;
                return this.getRecentBlockhash('max');

              case 5:
                _yield$this$getRecent = _context46.sent;
                blockhash = _yield$this$getRecent.blockhash;

                if (!(this._blockhashInfo.recentBlockhash != blockhash)) {
                  _context46.next = 10;
                  break;
                }

                this._blockhashInfo = {
                  recentBlockhash: blockhash,
                  lastFetch: new Date(),
                  transactionSignatures: [],
                  simulatedSignatures: []
                };
                return _context46.abrupt("return", blockhash);

              case 10:
                _context46.next = 12;
                return sleep(MS_PER_SLOT / 2);

              case 12:
                i++;
                _context46.next = 2;
                break;

              case 15:
                throw new Error("Unable to obtain a new blockhash after ".concat(Date.now() - startTime, "ms"));

              case 16:
              case "end":
                return _context46.stop();
            }
          }
        }, _callee46, this);
      }));

      function _pollNewBlockhash() {
        return _pollNewBlockhash2.apply(this, arguments);
      }

      return _pollNewBlockhash;
    }()
    /**
     * Simulate a transaction
     */

  }, {
    key: "simulateTransaction",
    value: function () {
      var _simulateTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee47(transaction, signers) {
        var disableCache, signature, signData, wireTransaction, encodedTransaction, args, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee47$(_context47) {
          while (1) {
            switch (_context47.prev = _context47.next) {
              case 0:
                if (!(transaction.nonceInfo && signers)) {
                  _context47.next = 4;
                  break;
                }

                transaction.sign.apply(transaction, _toConsumableArray(signers));
                _context47.next = 22;
                break;

              case 4:
                disableCache = this._disableBlockhashCaching;

              case 5:
                _context47.next = 7;
                return this._recentBlockhash(disableCache);

              case 7:
                transaction.recentBlockhash = _context47.sent;

                if (signers) {
                  _context47.next = 10;
                  break;
                }

                return _context47.abrupt("break", 22);

              case 10:
                transaction.sign.apply(transaction, _toConsumableArray(signers));

                if (transaction.signature) {
                  _context47.next = 13;
                  break;
                }

                throw new Error('!signature');

              case 13:
                // If the signature of this transaction has not been seen before with the
                // current recentBlockhash, all done.
                signature = transaction.signature.toString('base64');

                if (!(!this._blockhashInfo.simulatedSignatures.includes(signature) && !this._blockhashInfo.transactionSignatures.includes(signature))) {
                  _context47.next = 19;
                  break;
                }

                this._blockhashInfo.simulatedSignatures.push(signature);

                return _context47.abrupt("break", 22);

              case 19:
                disableCache = true;

              case 20:
                _context47.next = 5;
                break;

              case 22:
                signData = transaction.serializeMessage();
                wireTransaction = transaction._serialize(signData);
                encodedTransaction = bs58.encode(wireTransaction);
                args = [encodedTransaction];

                if (signers) {
                  args.push({
                    sigVerify: true
                  });
                }

                _context47.next = 29;
                return this._rpcRequest('simulateTransaction', args);

              case 29:
                unsafeRes = _context47.sent;
                res = SimulatedTransactionResponseValidator(unsafeRes);

                if (!res.error) {
                  _context47.next = 33;
                  break;
                }

                throw new Error('failed to simulate transaction: ' + res.error.message);

              case 33:
                assert(typeof res.result !== 'undefined');
                assert(res.result);
                return _context47.abrupt("return", res.result);

              case 36:
              case "end":
                return _context47.stop();
            }
          }
        }, _callee47, this);
      }));

      function simulateTransaction(_x66, _x67) {
        return _simulateTransaction.apply(this, arguments);
      }

      return simulateTransaction;
    }()
    /**
     * Sign and send a transaction
     */

  }, {
    key: "sendTransaction",
    value: function () {
      var _sendTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee48(transaction, signers, options) {
        var disableCache, signature, wireTransaction;
        return _regeneratorRuntime.wrap(function _callee48$(_context48) {
          while (1) {
            switch (_context48.prev = _context48.next) {
              case 0:
                if (!transaction.nonceInfo) {
                  _context48.next = 4;
                  break;
                }

                transaction.sign.apply(transaction, _toConsumableArray(signers));
                _context48.next = 20;
                break;

              case 4:
                disableCache = this._disableBlockhashCaching;

              case 5:
                _context48.next = 7;
                return this._recentBlockhash(disableCache);

              case 7:
                transaction.recentBlockhash = _context48.sent;
                transaction.sign.apply(transaction, _toConsumableArray(signers));

                if (transaction.signature) {
                  _context48.next = 11;
                  break;
                }

                throw new Error('!signature');

              case 11:
                // If the signature of this transaction has not been seen before with the
                // current recentBlockhash, all done.
                signature = transaction.signature.toString('base64');

                if (this._blockhashInfo.transactionSignatures.includes(signature)) {
                  _context48.next = 17;
                  break;
                }

                this._blockhashInfo.transactionSignatures.push(signature);

                return _context48.abrupt("break", 20);

              case 17:
                disableCache = true;

              case 18:
                _context48.next = 5;
                break;

              case 20:
                wireTransaction = transaction.serialize();
                _context48.next = 23;
                return this.sendRawTransaction(wireTransaction, options);

              case 23:
                return _context48.abrupt("return", _context48.sent);

              case 24:
              case "end":
                return _context48.stop();
            }
          }
        }, _callee48, this);
      }));

      function sendTransaction(_x68, _x69, _x70) {
        return _sendTransaction.apply(this, arguments);
      }

      return sendTransaction;
    }()
    /**
     * @private
     */

  }, {
    key: "validatorExit",
    value: function () {
      var _validatorExit = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee49() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee49$(_context49) {
          while (1) {
            switch (_context49.prev = _context49.next) {
              case 0:
                _context49.next = 2;
                return this._rpcRequest('validatorExit', []);

              case 2:
                unsafeRes = _context49.sent;
                res = jsonRpcResult('boolean')(unsafeRes);

                if (!res.error) {
                  _context49.next = 6;
                  break;
                }

                throw new Error('validator exit failed: ' + res.error.message);

              case 6:
                assert(typeof res.result !== 'undefined');
                return _context49.abrupt("return", res.result);

              case 8:
              case "end":
                return _context49.stop();
            }
          }
        }, _callee49, this);
      }));

      function validatorExit() {
        return _validatorExit.apply(this, arguments);
      }

      return validatorExit;
    }()
    /**
     * Send a transaction that has already been signed and serialized into the
     * wire format
     */

  }, {
    key: "sendRawTransaction",
    value: function () {
      var _sendRawTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee50(rawTransaction, options) {
        var encodedTransaction, result;
        return _regeneratorRuntime.wrap(function _callee50$(_context50) {
          while (1) {
            switch (_context50.prev = _context50.next) {
              case 0:
                encodedTransaction = bs58.encode(toBuffer(rawTransaction));
                _context50.next = 3;
                return this.sendEncodedTransaction(encodedTransaction, options);

              case 3:
                result = _context50.sent;
                return _context50.abrupt("return", result);

              case 5:
              case "end":
                return _context50.stop();
            }
          }
        }, _callee50, this);
      }));

      function sendRawTransaction(_x71, _x72) {
        return _sendRawTransaction.apply(this, arguments);
      }

      return sendRawTransaction;
    }()
    /**
     * Send a transaction that has already been signed, serialized into the
     * wire format, and encoded as a base58 string
     */

  }, {
    key: "sendEncodedTransaction",
    value: function () {
      var _sendEncodedTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee51(encodedTransaction, options) {
        var args, skipPreflight, unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee51$(_context51) {
          while (1) {
            switch (_context51.prev = _context51.next) {
              case 0:
                args = [encodedTransaction];
                skipPreflight = options && options.skipPreflight;
                if (skipPreflight) args.push({
                  skipPreflight: skipPreflight
                });
                _context51.next = 5;
                return this._rpcRequest('sendTransaction', args);

              case 5:
                unsafeRes = _context51.sent;
                res = SendTransactionRpcResult(unsafeRes);

                if (!res.error) {
                  _context51.next = 9;
                  break;
                }

                throw new Error('failed to send transaction: ' + res.error.message);

              case 9:
                assert(typeof res.result !== 'undefined');
                assert(res.result);
                return _context51.abrupt("return", res.result);

              case 12:
              case "end":
                return _context51.stop();
            }
          }
        }, _callee51, this);
      }));

      function sendEncodedTransaction(_x73, _x74) {
        return _sendEncodedTransaction.apply(this, arguments);
      }

      return sendEncodedTransaction;
    }()
    /**
     * @private
     */

  }, {
    key: "_wsOnOpen",
    value: function _wsOnOpen() {
      this._rpcWebSocketConnected = true;

      this._updateSubscriptions();
    }
    /**
     * @private
     */

  }, {
    key: "_wsOnError",
    value: function _wsOnError(err) {
      console.error('ws error:', err.message);
    }
    /**
     * @private
     */

  }, {
    key: "_wsOnClose",
    value: function _wsOnClose() {
      this._rpcWebSocketConnected = false;

      this._resetSubscriptions();
    }
    /**
     * @private
     */

  }, {
    key: "_subscribe",
    value: function () {
      var _subscribe2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee52(sub, rpcMethod, rpcArgs) {
        var id;
        return _regeneratorRuntime.wrap(function _callee52$(_context52) {
          while (1) {
            switch (_context52.prev = _context52.next) {
              case 0:
                if (!(sub.subscriptionId == null)) {
                  _context52.next = 13;
                  break;
                }

                sub.subscriptionId = 'subscribing';
                _context52.prev = 2;
                _context52.next = 5;
                return this._rpcWebSocket.call(rpcMethod, rpcArgs);

              case 5:
                id = _context52.sent;

                if (sub.subscriptionId === 'subscribing') {
                  // eslint-disable-next-line require-atomic-updates
                  sub.subscriptionId = id;
                }

                _context52.next = 13;
                break;

              case 9:
                _context52.prev = 9;
                _context52.t0 = _context52["catch"](2);

                if (sub.subscriptionId === 'subscribing') {
                  // eslint-disable-next-line require-atomic-updates
                  sub.subscriptionId = null;
                }

                console.error("".concat(rpcMethod, " error for argument"), rpcArgs, _context52.t0.message);

              case 13:
              case "end":
                return _context52.stop();
            }
          }
        }, _callee52, this, [[2, 9]]);
      }));

      function _subscribe(_x75, _x76, _x77) {
        return _subscribe2.apply(this, arguments);
      }

      return _subscribe;
    }()
    /**
     * @private
     */

  }, {
    key: "_unsubscribe",
    value: function () {
      var _unsubscribe2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee53(sub, rpcMethod) {
        var subscriptionId, unsubscribeId;
        return _regeneratorRuntime.wrap(function _callee53$(_context53) {
          while (1) {
            switch (_context53.prev = _context53.next) {
              case 0:
                subscriptionId = sub.subscriptionId;

                if (!(subscriptionId != null && typeof subscriptionId != 'string')) {
                  _context53.next = 11;
                  break;
                }

                unsubscribeId = subscriptionId;
                _context53.prev = 3;
                _context53.next = 6;
                return this._rpcWebSocket.call(rpcMethod, [unsubscribeId]);

              case 6:
                _context53.next = 11;
                break;

              case 8:
                _context53.prev = 8;
                _context53.t0 = _context53["catch"](3);
                console.error("".concat(rpcMethod, " error:"), _context53.t0.message);

              case 11:
              case "end":
                return _context53.stop();
            }
          }
        }, _callee53, this, [[3, 8]]);
      }));

      function _unsubscribe(_x78, _x79) {
        return _unsubscribe2.apply(this, arguments);
      }

      return _unsubscribe;
    }()
    /**
     * @private
     */

  }, {
    key: "_resetSubscriptions",
    value: function _resetSubscriptions() {
      Object.values(this._accountChangeSubscriptions).forEach(function (s) {
        return s.subscriptionId = null;
      });
      Object.values(this._programAccountChangeSubscriptions).forEach(function (s) {
        return s.subscriptionId = null;
      });
      Object.values(this._signatureSubscriptions).forEach(function (s) {
        return s.subscriptionId = null;
      });
      Object.values(this._slotSubscriptions).forEach(function (s) {
        return s.subscriptionId = null;
      });
      Object.values(this._rootSubscriptions).forEach(function (s) {
        return s.subscriptionId = null;
      });
    }
    /**
     * @private
     */

  }, {
    key: "_updateSubscriptions",
    value: function _updateSubscriptions() {
      var accountKeys = Object.keys(this._accountChangeSubscriptions).map(Number);
      var programKeys = Object.keys(this._programAccountChangeSubscriptions).map(Number);
      var slotKeys = Object.keys(this._slotSubscriptions).map(Number);
      var signatureKeys = Object.keys(this._signatureSubscriptions).map(Number);
      var rootKeys = Object.keys(this._rootSubscriptions).map(Number);

      if (accountKeys.length === 0 && programKeys.length === 0 && slotKeys.length === 0 && signatureKeys.length === 0 && rootKeys.length === 0) {
        this._rpcWebSocket.close();

        return;
      }

      if (!this._rpcWebSocketConnected) {
        this._resetSubscriptions();

        this._rpcWebSocket.connect();

        return;
      }

      var _iterator = _createForOfIteratorHelper$1(accountKeys),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var id = _step.value;
          var sub = this._accountChangeSubscriptions[id];

          this._subscribe(sub, 'accountSubscribe', this._buildArgs([sub.publicKey], sub.commitment, 'base64'));
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      var _iterator2 = _createForOfIteratorHelper$1(programKeys),
          _step2;

      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var _id = _step2.value;
          var _sub = this._programAccountChangeSubscriptions[_id];

          this._subscribe(_sub, 'programSubscribe', this._buildArgs([_sub.programId], _sub.commitment, 'base64'));
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }

      var _iterator3 = _createForOfIteratorHelper$1(slotKeys),
          _step3;

      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var _id2 = _step3.value;
          var _sub2 = this._slotSubscriptions[_id2];

          this._subscribe(_sub2, 'slotSubscribe', []);
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }

      var _iterator4 = _createForOfIteratorHelper$1(signatureKeys),
          _step4;

      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var _id3 = _step4.value;
          var _sub3 = this._signatureSubscriptions[_id3];

          this._subscribe(_sub3, 'signatureSubscribe', this._buildArgs([_sub3.signature], _sub3.commitment));
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }

      var _iterator5 = _createForOfIteratorHelper$1(rootKeys),
          _step5;

      try {
        for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
          var _id4 = _step5.value;
          var _sub4 = this._rootSubscriptions[_id4];

          this._subscribe(_sub4, 'rootSubscribe', []);
        }
      } catch (err) {
        _iterator5.e(err);
      } finally {
        _iterator5.f();
      }
    }
    /**
     * @private
     */

  }, {
    key: "_wsOnAccountNotification",
    value: function _wsOnAccountNotification(notification) {
      var res = AccountNotificationResult(notification);

      if (res.error) {
        throw new Error('account notification failed: ' + res.error.message);
      }

      assert(typeof res.result !== 'undefined');
      var keys = Object.keys(this._accountChangeSubscriptions).map(Number);

      var _iterator6 = _createForOfIteratorHelper$1(keys),
          _step6;

      try {
        for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
          var id = _step6.value;
          var sub = this._accountChangeSubscriptions[id];

          if (sub.subscriptionId === res.subscription) {
            var result = res.result;
            var value = result.value,
                _context54 = result.context;
            assert(value.data[1] === 'base64');
            sub.callback({
              executable: value.executable,
              owner: new PublicKey(value.owner),
              lamports: value.lamports,
              data: Buffer.from(value.data[0], 'base64')
            }, _context54);
            return true;
          }
        }
      } catch (err) {
        _iterator6.e(err);
      } finally {
        _iterator6.f();
      }
    }
    /**
     * Register a callback to be invoked whenever the specified account changes
     *
     * @param publicKey Public key of the account to monitor
     * @param callback Function to invoke whenever the account is changed
     * @param commitment Specify the commitment level account changes must reach before notification
     * @return subscription id
     */

  }, {
    key: "onAccountChange",
    value: function onAccountChange(publicKey, callback, commitment) {
      var id = ++this._accountChangeSubscriptionCounter;
      this._accountChangeSubscriptions[id] = {
        publicKey: publicKey.toBase58(),
        callback: callback,
        commitment: commitment,
        subscriptionId: null
      };

      this._updateSubscriptions();

      return id;
    }
    /**
     * Deregister an account notification callback
     *
     * @param id subscription id to deregister
     */

  }, {
    key: "removeAccountChangeListener",
    value: function () {
      var _removeAccountChangeListener = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee54(id) {
        var subInfo;
        return _regeneratorRuntime.wrap(function _callee54$(_context55) {
          while (1) {
            switch (_context55.prev = _context55.next) {
              case 0:
                if (!this._accountChangeSubscriptions[id]) {
                  _context55.next = 8;
                  break;
                }

                subInfo = this._accountChangeSubscriptions[id];
                delete this._accountChangeSubscriptions[id];
                _context55.next = 5;
                return this._unsubscribe(subInfo, 'accountUnsubscribe');

              case 5:
                this._updateSubscriptions();

                _context55.next = 9;
                break;

              case 8:
                throw new Error("Unknown account change id: ".concat(id));

              case 9:
              case "end":
                return _context55.stop();
            }
          }
        }, _callee54, this);
      }));

      function removeAccountChangeListener(_x80) {
        return _removeAccountChangeListener.apply(this, arguments);
      }

      return removeAccountChangeListener;
    }()
    /**
     * @private
     */

  }, {
    key: "_wsOnProgramAccountNotification",
    value: function _wsOnProgramAccountNotification(notification) {
      var res = ProgramAccountNotificationResult(notification);

      if (res.error) {
        throw new Error('program account notification failed: ' + res.error.message);
      }

      assert(typeof res.result !== 'undefined');
      var keys = Object.keys(this._programAccountChangeSubscriptions).map(Number);

      var _iterator7 = _createForOfIteratorHelper$1(keys),
          _step7;

      try {
        for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
          var id = _step7.value;
          var sub = this._programAccountChangeSubscriptions[id];

          if (sub.subscriptionId === res.subscription) {
            var result = res.result;
            var value = result.value,
                _context56 = result.context;
            assert(value.account.data[1] === 'base64');
            sub.callback({
              accountId: value.pubkey,
              accountInfo: {
                executable: value.account.executable,
                owner: new PublicKey(value.account.owner),
                lamports: value.account.lamports,
                data: Buffer.from(value.account.data[0], 'base64')
              }
            }, _context56);
            return true;
          }
        }
      } catch (err) {
        _iterator7.e(err);
      } finally {
        _iterator7.f();
      }
    }
    /**
     * Register a callback to be invoked whenever accounts owned by the
     * specified program change
     *
     * @param programId Public key of the program to monitor
     * @param callback Function to invoke whenever the account is changed
     * @param commitment Specify the commitment level account changes must reach before notification
     * @return subscription id
     */

  }, {
    key: "onProgramAccountChange",
    value: function onProgramAccountChange(programId, callback, commitment) {
      var id = ++this._programAccountChangeSubscriptionCounter;
      this._programAccountChangeSubscriptions[id] = {
        programId: programId.toBase58(),
        callback: callback,
        commitment: commitment,
        subscriptionId: null
      };

      this._updateSubscriptions();

      return id;
    }
    /**
     * Deregister an account notification callback
     *
     * @param id subscription id to deregister
     */

  }, {
    key: "removeProgramAccountChangeListener",
    value: function () {
      var _removeProgramAccountChangeListener = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee55(id) {
        var subInfo;
        return _regeneratorRuntime.wrap(function _callee55$(_context57) {
          while (1) {
            switch (_context57.prev = _context57.next) {
              case 0:
                if (!this._programAccountChangeSubscriptions[id]) {
                  _context57.next = 8;
                  break;
                }

                subInfo = this._programAccountChangeSubscriptions[id];
                delete this._programAccountChangeSubscriptions[id];
                _context57.next = 5;
                return this._unsubscribe(subInfo, 'programUnsubscribe');

              case 5:
                this._updateSubscriptions();

                _context57.next = 9;
                break;

              case 8:
                throw new Error("Unknown program account change id: ".concat(id));

              case 9:
              case "end":
                return _context57.stop();
            }
          }
        }, _callee55, this);
      }));

      function removeProgramAccountChangeListener(_x81) {
        return _removeProgramAccountChangeListener.apply(this, arguments);
      }

      return removeProgramAccountChangeListener;
    }()
    /**
     * @private
     */

  }, {
    key: "_wsOnSlotNotification",
    value: function _wsOnSlotNotification(notification) {
      var res = SlotNotificationResult(notification);

      if (res.error) {
        throw new Error('slot notification failed: ' + res.error.message);
      }

      assert(typeof res.result !== 'undefined');
      var _res$result2 = res.result,
          parent = _res$result2.parent,
          slot = _res$result2.slot,
          root = _res$result2.root;
      var keys = Object.keys(this._slotSubscriptions).map(Number);

      var _iterator8 = _createForOfIteratorHelper$1(keys),
          _step8;

      try {
        for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
          var id = _step8.value;
          var sub = this._slotSubscriptions[id];

          if (sub.subscriptionId === res.subscription) {
            sub.callback({
              parent: parent,
              slot: slot,
              root: root
            });
            return true;
          }
        }
      } catch (err) {
        _iterator8.e(err);
      } finally {
        _iterator8.f();
      }
    }
    /**
     * Register a callback to be invoked upon slot changes
     *
     * @param callback Function to invoke whenever the slot changes
     * @return subscription id
     */

  }, {
    key: "onSlotChange",
    value: function onSlotChange(callback) {
      var id = ++this._slotSubscriptionCounter;
      this._slotSubscriptions[id] = {
        callback: callback,
        subscriptionId: null
      };

      this._updateSubscriptions();

      return id;
    }
    /**
     * Deregister a slot notification callback
     *
     * @param id subscription id to deregister
     */

  }, {
    key: "removeSlotChangeListener",
    value: function () {
      var _removeSlotChangeListener = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee56(id) {
        var subInfo;
        return _regeneratorRuntime.wrap(function _callee56$(_context58) {
          while (1) {
            switch (_context58.prev = _context58.next) {
              case 0:
                if (!this._slotSubscriptions[id]) {
                  _context58.next = 8;
                  break;
                }

                subInfo = this._slotSubscriptions[id];
                delete this._slotSubscriptions[id];
                _context58.next = 5;
                return this._unsubscribe(subInfo, 'slotUnsubscribe');

              case 5:
                this._updateSubscriptions();

                _context58.next = 9;
                break;

              case 8:
                throw new Error("Unknown slot change id: ".concat(id));

              case 9:
              case "end":
                return _context58.stop();
            }
          }
        }, _callee56, this);
      }));

      function removeSlotChangeListener(_x82) {
        return _removeSlotChangeListener.apply(this, arguments);
      }

      return removeSlotChangeListener;
    }()
  }, {
    key: "_buildArgs",
    value: function _buildArgs(args, override, encoding) {
      var commitment = override || this._commitment;

      if (commitment || encoding) {
        var options = {};

        if (encoding) {
          options.encoding = encoding;
        }

        if (commitment) {
          options.commitment = commitment;
        }

        args.push(options);
      }

      return args;
    }
    /**
     * @private
     */

  }, {
    key: "_wsOnSignatureNotification",
    value: function _wsOnSignatureNotification(notification) {
      var res = SignatureNotificationResult(notification);

      if (res.error) {
        throw new Error('signature notification failed: ' + res.error.message);
      }

      assert(typeof res.result !== 'undefined');
      var keys = Object.keys(this._signatureSubscriptions).map(Number);

      var _iterator9 = _createForOfIteratorHelper$1(keys),
          _step9;

      try {
        for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
          var id = _step9.value;
          var sub = this._signatureSubscriptions[id];

          if (sub.subscriptionId === res.subscription) {
            // Signatures subscriptions are auto-removed by the RPC service so
            // no need to explicitly send an unsubscribe message
            delete this._signatureSubscriptions[id];

            this._updateSubscriptions();

            sub.callback(res.result.value, res.result.context);
            return;
          }
        }
      } catch (err) {
        _iterator9.e(err);
      } finally {
        _iterator9.f();
      }
    }
    /**
     * Register a callback to be invoked upon signature updates
     *
     * @param signature Transaction signature string in base 58
     * @param callback Function to invoke on signature notifications
     * @param commitment Specify the commitment level signature must reach before notification
     * @return subscription id
     */

  }, {
    key: "onSignature",
    value: function onSignature(signature, callback, commitment) {
      var id = ++this._signatureSubscriptionCounter;
      this._signatureSubscriptions[id] = {
        signature: signature,
        callback: callback,
        commitment: commitment,
        subscriptionId: null
      };

      this._updateSubscriptions();

      return id;
    }
    /**
     * Deregister a signature notification callback
     *
     * @param id subscription id to deregister
     */

  }, {
    key: "removeSignatureListener",
    value: function () {
      var _removeSignatureListener = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee57(id) {
        var subInfo;
        return _regeneratorRuntime.wrap(function _callee57$(_context59) {
          while (1) {
            switch (_context59.prev = _context59.next) {
              case 0:
                if (!this._signatureSubscriptions[id]) {
                  _context59.next = 8;
                  break;
                }

                subInfo = this._signatureSubscriptions[id];
                delete this._signatureSubscriptions[id];
                _context59.next = 5;
                return this._unsubscribe(subInfo, 'signatureUnsubscribe');

              case 5:
                this._updateSubscriptions();

                _context59.next = 9;
                break;

              case 8:
                throw new Error("Unknown signature result id: ".concat(id));

              case 9:
              case "end":
                return _context59.stop();
            }
          }
        }, _callee57, this);
      }));

      function removeSignatureListener(_x83) {
        return _removeSignatureListener.apply(this, arguments);
      }

      return removeSignatureListener;
    }()
    /**
     * @private
     */

  }, {
    key: "_wsOnRootNotification",
    value: function _wsOnRootNotification(notification) {
      var res = RootNotificationResult(notification);

      if (res.error) {
        throw new Error('root notification failed: ' + res.error.message);
      }

      assert(typeof res.result !== 'undefined');
      var root = res.result;
      var keys = Object.keys(this._rootSubscriptions).map(Number);

      var _iterator10 = _createForOfIteratorHelper$1(keys),
          _step10;

      try {
        for (_iterator10.s(); !(_step10 = _iterator10.n()).done;) {
          var id = _step10.value;
          var sub = this._rootSubscriptions[id];

          if (sub.subscriptionId === res.subscription) {
            sub.callback(root);
            return true;
          }
        }
      } catch (err) {
        _iterator10.e(err);
      } finally {
        _iterator10.f();
      }
    }
    /**
     * Register a callback to be invoked upon root changes
     *
     * @param callback Function to invoke whenever the root changes
     * @return subscription id
     */

  }, {
    key: "onRootChange",
    value: function onRootChange(callback) {
      var id = ++this._rootSubscriptionCounter;
      this._rootSubscriptions[id] = {
        callback: callback,
        subscriptionId: null
      };

      this._updateSubscriptions();

      return id;
    }
    /**
     * Deregister a root notification callback
     *
     * @param id subscription id to deregister
     */

  }, {
    key: "removeRootChangeListener",
    value: function () {
      var _removeRootChangeListener = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee58(id) {
        var subInfo;
        return _regeneratorRuntime.wrap(function _callee58$(_context60) {
          while (1) {
            switch (_context60.prev = _context60.next) {
              case 0:
                if (!this._rootSubscriptions[id]) {
                  _context60.next = 8;
                  break;
                }

                subInfo = this._rootSubscriptions[id];
                delete this._rootSubscriptions[id];
                _context60.next = 5;
                return this._unsubscribe(subInfo, 'rootUnsubscribe');

              case 5:
                this._updateSubscriptions();

                _context60.next = 9;
                break;

              case 8:
                throw new Error("Unknown root change id: ".concat(id));

              case 9:
              case "end":
                return _context60.stop();
            }
          }
        }, _callee58, this);
      }));

      function removeRootChangeListener(_x84) {
        return _removeRootChangeListener.apply(this, arguments);
      }

      return removeRootChangeListener;
    }()
  }, {
    key: "commitment",
    get: function get() {
      return this._commitment;
    }
  }]);

  return Connection;
}();

/**
 * Sign, send and confirm a transaction.
 *
 * If `confirmations` count is not specified, wait for transaction to be finalized.
 *
 * @param {Connection} connection
 * @param {Transaction} transaction
 * @param {Array<Account>} signers
 * @param {ConfirmOptions} [options]
 * @returns {Promise<TransactionSignature>}
 */
function sendAndConfirmTransaction(_x, _x2, _x3, _x4) {
  return _sendAndConfirmTransaction.apply(this, arguments);
}

function _sendAndConfirmTransaction() {
  _sendAndConfirmTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(connection, transaction, signers, options) {
    var start, signature, status, duration;
    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            start = Date.now();
            _context.next = 3;
            return connection.sendTransaction(transaction, signers, options);

          case 3:
            signature = _context.sent;
            _context.next = 6;
            return connection.confirmTransaction(signature, options && options.confirmations);

          case 6:
            status = _context.sent.value;

            if (!status) {
              _context.next = 11;
              break;
            }

            if (!status.err) {
              _context.next = 10;
              break;
            }

            throw new Error("Transaction ".concat(signature, " failed (").concat(JSON.stringify(status), ")"));

          case 10:
            return _context.abrupt("return", signature);

          case 11:
            duration = (Date.now() - start) / 1000;
            throw new Error("Transaction was not confirmed in ".concat(duration.toFixed(2), " seconds (").concat(JSON.stringify(status), ")"));

          case 13:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));
  return _sendAndConfirmTransaction.apply(this, arguments);
}

/**
 * @typedef {Object} InstructionType
 * @property (index} The Instruction index (from solana upstream program)
 * @property (BufferLayout} The BufferLayout to use to build data
 */

/**
 * Populate a buffer of instruction data using an InstructionType
 */
function encodeData(type, fields) {
  var allocLength = type.layout.span >= 0 ? type.layout.span : getAlloc(type, fields);
  var data = Buffer.alloc(allocLength);
  var layoutFields = Object.assign({
    instruction: type.index
  }, fields);
  type.layout.encode(layoutFields, data);
  return data;
}
/**
 * Decode instruction data buffer using an InstructionType
 */

function decodeData(type, buffer) {
  var data;

  try {
    data = type.layout.decode(buffer);
  } catch (err) {
    throw new Error('invalid instruction; ' + err);
  }

  if (data.instruction !== type.index) {
    throw new Error("invalid instruction; instruction index mismatch ".concat(data.instruction, " != ").concat(type.index));
  }

  return data;
}

/**
 * Create account system transaction params
 * @typedef {Object} CreateAccountParams
 * @property {PublicKey} fromPubkey
 * @property {PublicKey} newAccountPubkey
 * @property {number} lamports
 * @property {number} space
 * @property {PublicKey} programId
 */

/**
 * System Instruction class
 */
var SystemInstruction = /*#__PURE__*/function () {
  function SystemInstruction() {
    _classCallCheck(this, SystemInstruction);
  }

  _createClass(SystemInstruction, null, [{
    key: "decodeInstructionType",

    /**
     * Decode a system instruction and retrieve the instruction type.
     */
    value: function decodeInstructionType(instruction) {
      this.checkProgramId(instruction.programId);
      var instructionTypeLayout = u32('instruction');
      var typeIndex = instructionTypeLayout.decode(instruction.data);
      var type;

      for (var _i = 0, _Object$keys = Object.keys(SYSTEM_INSTRUCTION_LAYOUTS); _i < _Object$keys.length; _i++) {
        var t = _Object$keys[_i];

        if (SYSTEM_INSTRUCTION_LAYOUTS[t].index == typeIndex) {
          type = t;
        }
      }

      if (!type) {
        throw new Error('Instruction type incorrect; not a SystemInstruction');
      }

      return type;
    }
    /**
     * Decode a create account system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeCreateAccount",
    value: function decodeCreateAccount(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 2);

      var _decodeData = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Create, instruction.data),
          lamports = _decodeData.lamports,
          space = _decodeData.space,
          programId = _decodeData.programId;

      return {
        fromPubkey: instruction.keys[0].pubkey,
        newAccountPubkey: instruction.keys[1].pubkey,
        lamports: lamports,
        space: space,
        programId: new PublicKey(programId)
      };
    }
    /**
     * Decode a transfer system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeTransfer",
    value: function decodeTransfer(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 2);

      var _decodeData2 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Transfer, instruction.data),
          lamports = _decodeData2.lamports;

      return {
        fromPubkey: instruction.keys[0].pubkey,
        toPubkey: instruction.keys[1].pubkey,
        lamports: lamports
      };
    }
    /**
     * Decode an allocate system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeAllocate",
    value: function decodeAllocate(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 1);

      var _decodeData3 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Allocate, instruction.data),
          space = _decodeData3.space;

      return {
        accountPubkey: instruction.keys[0].pubkey,
        space: space
      };
    }
    /**
     * Decode an allocate with seed system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeAllocateWithSeed",
    value: function decodeAllocateWithSeed(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 1);

      var _decodeData4 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AllocateWithSeed, instruction.data),
          base = _decodeData4.base,
          seed = _decodeData4.seed,
          space = _decodeData4.space,
          programId = _decodeData4.programId;

      return {
        accountPubkey: instruction.keys[0].pubkey,
        basePubkey: new PublicKey(base),
        seed: seed,
        space: space,
        programId: new PublicKey(programId)
      };
    }
    /**
     * Decode an assign system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeAssign",
    value: function decodeAssign(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 1);

      var _decodeData5 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.Assign, instruction.data),
          programId = _decodeData5.programId;

      return {
        accountPubkey: instruction.keys[0].pubkey,
        programId: new PublicKey(programId)
      };
    }
    /**
     * Decode an assign with seed system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeAssignWithSeed",
    value: function decodeAssignWithSeed(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 1);

      var _decodeData6 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AssignWithSeed, instruction.data),
          base = _decodeData6.base,
          seed = _decodeData6.seed,
          programId = _decodeData6.programId;

      return {
        accountPubkey: instruction.keys[0].pubkey,
        basePubkey: new PublicKey(base),
        seed: seed,
        programId: new PublicKey(programId)
      };
    }
    /**
     * Decode a create account with seed system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeCreateWithSeed",
    value: function decodeCreateWithSeed(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 2);

      var _decodeData7 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.CreateWithSeed, instruction.data),
          base = _decodeData7.base,
          seed = _decodeData7.seed,
          lamports = _decodeData7.lamports,
          space = _decodeData7.space,
          programId = _decodeData7.programId;

      return {
        fromPubkey: instruction.keys[0].pubkey,
        newAccountPubkey: instruction.keys[1].pubkey,
        basePubkey: new PublicKey(base),
        seed: seed,
        lamports: lamports,
        space: space,
        programId: new PublicKey(programId)
      };
    }
    /**
     * Decode a nonce initialize system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeNonceInitialize",
    value: function decodeNonceInitialize(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 3);

      var _decodeData8 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.InitializeNonceAccount, instruction.data),
          authorized = _decodeData8.authorized;

      return {
        noncePubkey: instruction.keys[0].pubkey,
        authorizedPubkey: new PublicKey(authorized)
      };
    }
    /**
     * Decode a nonce advance system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeNonceAdvance",
    value: function decodeNonceAdvance(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 3);
      decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AdvanceNonceAccount, instruction.data);
      return {
        noncePubkey: instruction.keys[0].pubkey,
        authorizedPubkey: instruction.keys[2].pubkey
      };
    }
    /**
     * Decode a nonce withdraw system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeNonceWithdraw",
    value: function decodeNonceWithdraw(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 5);

      var _decodeData9 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.WithdrawNonceAccount, instruction.data),
          lamports = _decodeData9.lamports;

      return {
        noncePubkey: instruction.keys[0].pubkey,
        toPubkey: instruction.keys[1].pubkey,
        authorizedPubkey: instruction.keys[4].pubkey,
        lamports: lamports
      };
    }
    /**
     * Decode a nonce authorize system instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeNonceAuthorize",
    value: function decodeNonceAuthorize(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 2);

      var _decodeData10 = decodeData(SYSTEM_INSTRUCTION_LAYOUTS.AuthorizeNonceAccount, instruction.data),
          authorized = _decodeData10.authorized;

      return {
        noncePubkey: instruction.keys[0].pubkey,
        authorizedPubkey: instruction.keys[1].pubkey,
        newAuthorizedPubkey: new PublicKey(authorized)
      };
    }
    /**
     * @private
     */

  }, {
    key: "checkProgramId",
    value: function checkProgramId(programId) {
      if (!programId.equals(SystemProgram.programId)) {
        throw new Error('invalid instruction; programId is not SystemProgram');
      }
    }
    /**
     * @private
     */

  }, {
    key: "checkKeyLength",
    value: function checkKeyLength(keys, expectedLength) {
      if (keys.length < expectedLength) {
        throw new Error("invalid instruction; found ".concat(keys.length, " keys, expected at least ").concat(expectedLength));
      }
    }
  }]);

  return SystemInstruction;
}();
/**
 * An enumeration of valid SystemInstructionType's
 * @typedef {'Create' | 'Assign' | 'Transfer' | 'CreateWithSeed'
 | 'AdvanceNonceAccount' | 'WithdrawNonceAccount' | 'InitializeNonceAccount'
 | 'AuthorizeNonceAccount'} SystemInstructionType
 */

/**
 * An enumeration of valid system InstructionType's
 */
var SYSTEM_INSTRUCTION_LAYOUTS = Object.freeze({
  Create: {
    index: 0,
    layout: struct([u32('instruction'), ns64('lamports'), ns64('space'), publicKey('programId')])
  },
  Assign: {
    index: 1,
    layout: struct([u32('instruction'), publicKey('programId')])
  },
  Transfer: {
    index: 2,
    layout: struct([u32('instruction'), ns64('lamports')])
  },
  CreateWithSeed: {
    index: 3,
    layout: struct([u32('instruction'), publicKey('base'), rustString('seed'), ns64('lamports'), ns64('space'), publicKey('programId')])
  },
  AdvanceNonceAccount: {
    index: 4,
    layout: struct([u32('instruction')])
  },
  WithdrawNonceAccount: {
    index: 5,
    layout: struct([u32('instruction'), ns64('lamports')])
  },
  InitializeNonceAccount: {
    index: 6,
    layout: struct([u32('instruction'), publicKey('authorized')])
  },
  AuthorizeNonceAccount: {
    index: 7,
    layout: struct([u32('instruction'), publicKey('authorized')])
  },
  Allocate: {
    index: 8,
    layout: struct([u32('instruction'), ns64('space')])
  },
  AllocateWithSeed: {
    index: 9,
    layout: struct([u32('instruction'), publicKey('base'), rustString('seed'), ns64('space'), publicKey('programId')])
  },
  AssignWithSeed: {
    index: 10,
    layout: struct([u32('instruction'), publicKey('base'), rustString('seed'), publicKey('programId')])
  }
});
/**
 * Factory class for transactions to interact with the System program
 */

var SystemProgram = /*#__PURE__*/function () {
  function SystemProgram() {
    _classCallCheck(this, SystemProgram);
  }

  _createClass(SystemProgram, null, [{
    key: "createAccount",

    /**
     * Generate a Transaction that creates a new account
     */
    value: function createAccount(params) {
      var type = SYSTEM_INSTRUCTION_LAYOUTS.Create;
      var data = encodeData(type, {
        lamports: params.lamports,
        space: params.space,
        programId: params.programId.toBuffer()
      });
      return new Transaction().add({
        keys: [{
          pubkey: params.fromPubkey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: params.newAccountPubkey,
          isSigner: true,
          isWritable: true
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that transfers lamports from one account to another
     */

  }, {
    key: "transfer",
    value: function transfer(params) {
      var type = SYSTEM_INSTRUCTION_LAYOUTS.Transfer;
      var data = encodeData(type, {
        lamports: params.lamports
      });
      return new Transaction().add({
        keys: [{
          pubkey: params.fromPubkey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: params.toPubkey,
          isSigner: false,
          isWritable: true
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that assigns an account to a program
     */

  }, {
    key: "assign",
    value: function assign(params) {
      var data;

      if (params.basePubkey) {
        var type = SYSTEM_INSTRUCTION_LAYOUTS.AssignWithSeed;
        data = encodeData(type, {
          base: params.basePubkey.toBuffer(),
          seed: params.seed,
          programId: params.programId.toBuffer()
        });
      } else {
        var _type = SYSTEM_INSTRUCTION_LAYOUTS.Assign;
        data = encodeData(_type, {
          programId: params.programId.toBuffer()
        });
      }

      return new Transaction().add({
        keys: [{
          pubkey: params.accountPubkey,
          isSigner: true,
          isWritable: true
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that creates a new account at
     *   an address generated with `from`, a seed, and programId
     */

  }, {
    key: "createAccountWithSeed",
    value: function createAccountWithSeed(params) {
      var type = SYSTEM_INSTRUCTION_LAYOUTS.CreateWithSeed;
      var data = encodeData(type, {
        base: params.basePubkey.toBuffer(),
        seed: params.seed,
        lamports: params.lamports,
        space: params.space,
        programId: params.programId.toBuffer()
      });
      return new Transaction().add({
        keys: [{
          pubkey: params.fromPubkey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: params.newAccountPubkey,
          isSigner: false,
          isWritable: true
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that creates a new Nonce account
     */

  }, {
    key: "createNonceAccount",
    value: function createNonceAccount(params) {
      var transaction;

      if (params.basePubkey && params.seed) {
        transaction = SystemProgram.createAccountWithSeed({
          fromPubkey: params.fromPubkey,
          newAccountPubkey: params.noncePubkey,
          basePubkey: params.basePubkey,
          seed: params.seed,
          lamports: params.lamports,
          space: NONCE_ACCOUNT_LENGTH,
          programId: this.programId
        });
      } else {
        transaction = SystemProgram.createAccount({
          fromPubkey: params.fromPubkey,
          newAccountPubkey: params.noncePubkey,
          lamports: params.lamports,
          space: NONCE_ACCOUNT_LENGTH,
          programId: this.programId
        });
      }

      var initParams = {
        noncePubkey: params.noncePubkey,
        authorizedPubkey: params.authorizedPubkey
      };
      transaction.add(this.nonceInitialize(initParams));
      return transaction;
    }
    /**
     * Generate an instruction to initialize a Nonce account
     */

  }, {
    key: "nonceInitialize",
    value: function nonceInitialize(params) {
      var type = SYSTEM_INSTRUCTION_LAYOUTS.InitializeNonceAccount;
      var data = encodeData(type, {
        authorized: params.authorizedPubkey.toBuffer()
      });
      var instructionData = {
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      };
      return new TransactionInstruction(instructionData);
    }
    /**
     * Generate an instruction to advance the nonce in a Nonce account
     */

  }, {
    key: "nonceAdvance",
    value: function nonceAdvance(params) {
      var type = SYSTEM_INSTRUCTION_LAYOUTS.AdvanceNonceAccount;
      var data = encodeData(type);
      var instructionData = {
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: params.authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      };
      return new TransactionInstruction(instructionData);
    }
    /**
     * Generate a Transaction that withdraws lamports from a Nonce account
     */

  }, {
    key: "nonceWithdraw",
    value: function nonceWithdraw(params) {
      var type = SYSTEM_INSTRUCTION_LAYOUTS.WithdrawNonceAccount;
      var data = encodeData(type, {
        lamports: params.lamports
      });
      return new Transaction().add({
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: params.toPubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: params.authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that authorizes a new PublicKey as the authority
     * on a Nonce account.
     */

  }, {
    key: "nonceAuthorize",
    value: function nonceAuthorize(params) {
      var type = SYSTEM_INSTRUCTION_LAYOUTS.AuthorizeNonceAccount;
      var data = encodeData(type, {
        authorized: params.newAuthorizedPubkey.toBuffer()
      });
      return new Transaction().add({
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: params.authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that allocates space in an account without funding
     */

  }, {
    key: "allocate",
    value: function allocate(params) {
      var data;

      if (params.basePubkey) {
        var type = SYSTEM_INSTRUCTION_LAYOUTS.AllocateWithSeed;
        data = encodeData(type, {
          base: params.basePubkey.toBuffer(),
          seed: params.seed,
          space: params.space,
          programId: params.programId.toBuffer()
        });
      } else {
        var _type2 = SYSTEM_INSTRUCTION_LAYOUTS.Allocate;
        data = encodeData(_type2, {
          space: params.space
        });
      }

      return new Transaction().add({
        keys: [{
          pubkey: params.accountPubkey,
          isSigner: true,
          isWritable: true
        }],
        programId: this.programId,
        data: data
      });
    }
  }, {
    key: "programId",

    /**
     * Public key that identifies the System program
     */
    get: function get() {
      return new PublicKey('11111111111111111111111111111111');
    }
  }]);

  return SystemProgram;
}();

/**
 * Program loader interface
 */

var Loader = /*#__PURE__*/function () {
  function Loader() {
    _classCallCheck(this, Loader);
  }

  _createClass(Loader, null, [{
    key: "getMinNumSignatures",

    /**
     * Minimum number of signatures required to load a program not including
     * retries
     *
     * Can be used to calculate transaction fees
     */
    value: function getMinNumSignatures(dataLength) {
      return Math.ceil(dataLength / Loader.chunkSize);
    }
    /**
     * Loads a generic program
     *
     * @param connection The connection to use
     * @param payer System account that pays to load the program
     * @param program Account to load the program into
     * @param programId Public key that identifies the loader
     * @param data Program octets
     */

  }, {
    key: "load",
    value: function () {
      var _load = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(connection, payer, program, programId, data) {
        var balanceNeeded, transaction, dataLayout, chunkSize, offset$1, array, transactions, bytes, _data, _transaction, _dataLayout, _data2, _transaction2;

        return _regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return connection.getMinimumBalanceForRentExemption(data.length);

              case 2:
                balanceNeeded = _context.sent;
                transaction = SystemProgram.createAccount({
                  fromPubkey: payer.publicKey,
                  newAccountPubkey: program.publicKey,
                  lamports: balanceNeeded > 0 ? balanceNeeded : 1,
                  space: data.length,
                  programId: programId
                });
                _context.next = 6;
                return sendAndConfirmTransaction(connection, transaction, [payer, program], {
                  confirmations: 1,
                  skipPreflight: true
                });

              case 6:
                dataLayout = struct([u32('instruction'), u32('offset'), u32('bytesLength'), u32('bytesLengthPadding'), seq(u8('byte'), offset(u32(), -8), 'bytes')]);
                chunkSize = Loader.chunkSize;
                offset$1 = 0;
                array = data;
                transactions = [];

              case 11:
                if (!(array.length > 0)) {
                  _context.next = 27;
                  break;
                }

                bytes = array.slice(0, chunkSize);
                _data = Buffer.alloc(chunkSize + 16);
                dataLayout.encode({
                  instruction: 0,
                  // Load instruction
                  offset: offset$1,
                  bytes: bytes
                }, _data);
                _transaction = new Transaction().add({
                  keys: [{
                    pubkey: program.publicKey,
                    isSigner: true,
                    isWritable: true
                  }],
                  programId: programId,
                  data: _data
                });
                transactions.push(sendAndConfirmTransaction(connection, _transaction, [payer, program], {
                  confirmations: 1,
                  skipPreflight: true
                })); // Delay ~1 tick between write transactions in an attempt to reduce AccountInUse errors
                // since all the write transactions modify the same program account

                _context.next = 19;
                return sleep(1000 / NUM_TICKS_PER_SECOND);

              case 19:
                if (!(transactions.length === 8)) {
                  _context.next = 23;
                  break;
                }

                _context.next = 22;
                return Promise.all(transactions);

              case 22:
                transactions = [];

              case 23:
                offset$1 += chunkSize;
                array = array.slice(chunkSize);
                _context.next = 11;
                break;

              case 27:
                _context.next = 29;
                return Promise.all(transactions);

              case 29:
                _dataLayout = struct([u32('instruction')]);
                _data2 = Buffer.alloc(_dataLayout.span);

                _dataLayout.encode({
                  instruction: 1 // Finalize instruction

                }, _data2);

                _transaction2 = new Transaction().add({
                  keys: [{
                    pubkey: program.publicKey,
                    isSigner: true,
                    isWritable: true
                  }, {
                    pubkey: SYSVAR_RENT_PUBKEY,
                    isSigner: false,
                    isWritable: false
                  }],
                  programId: programId,
                  data: _data2
                });
                _context.next = 35;
                return sendAndConfirmTransaction(connection, _transaction2, [payer, program], {
                  confirmations: 1,
                  skipPreflight: true
                });

              case 35:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      function load(_x, _x2, _x3, _x4, _x5) {
        return _load.apply(this, arguments);
      }

      return load;
    }()
  }, {
    key: "chunkSize",

    /**
     * Amount of program data placed in each load Transaction
     */
    get: function get() {
      // Keep program chunks under PACKET_DATA_SIZE, leaving enough room for the
      // rest of the Transaction fields
      //
      // TODO: replace 300 with a proper constant for the size of the other
      // Transaction fields
      return PACKET_DATA_SIZE - 300;
    }
  }]);

  return Loader;
}();

/**
 * Factory class for transactions to interact with a program loader
 */
var BpfLoader = /*#__PURE__*/function () {
  function BpfLoader() {
    _classCallCheck(this, BpfLoader);
  }

  _createClass(BpfLoader, null, [{
    key: "programId",

    /**
     * Public key that identifies the BpfLoader
     */
    value: function programId() {
      var version = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 2;

      if (version === 1) {
        return new PublicKey('BPFLoader1111111111111111111111111111111111');
      } else {
        return new PublicKey('BPFLoader2111111111111111111111111111111111');
      }
    }
    /**
     * Minimum number of signatures required to load a program not including
     * retries
     *
     * Can be used to calculate transaction fees
     */

  }, {
    key: "getMinNumSignatures",
    value: function getMinNumSignatures(dataLength) {
      return Loader.getMinNumSignatures(dataLength);
    }
    /**
     * Load a BPF program
     *
     * @param connection The connection to use
     * @param payer Account that will pay program loading fees
     * @param program Account to load the program into
     * @param elf The entire ELF containing the BPF program
     * @param version The version of the BPF loader to use
     */

  }, {
    key: "load",
    value: function load(connection, payer, program, elf) {
      var version = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 2;
      return Loader.load(connection, payer, program, BpfLoader.programId(version), elf);
    }
  }]);

  return BpfLoader;
}();

var STAKE_CONFIG_ID = new PublicKey('StakeConfig11111111111111111111111111111111');
var Authorized =
/**
 * Create a new Authorized object
 */
function Authorized(staker, withdrawer) {
  _classCallCheck(this, Authorized);

  _defineProperty(this, "staker", void 0);

  _defineProperty(this, "withdrawer", void 0);

  this.staker = staker;
  this.withdrawer = withdrawer;
};
var Lockup =
/**
 * Create a new Lockup object
 */
function Lockup(unixTimestamp, epoch, custodian) {
  _classCallCheck(this, Lockup);

  _defineProperty(this, "unixTimestamp", void 0);

  _defineProperty(this, "epoch", void 0);

  _defineProperty(this, "custodian", void 0);

  this.unixTimestamp = unixTimestamp;
  this.epoch = epoch;
  this.custodian = custodian;
};
/**
 * Create stake account transaction params
 * @typedef {Object} CreateStakeAccountParams
 * @property {PublicKey} fromPubkey
 * @property {PublicKey} stakePubkey
 * @property {Authorized} authorized
 * @property {Lockup} lockup
 * @property {number} lamports
 */

/**
 * Stake Instruction class
 */
var StakeInstruction = /*#__PURE__*/function () {
  function StakeInstruction() {
    _classCallCheck(this, StakeInstruction);
  }

  _createClass(StakeInstruction, null, [{
    key: "decodeInstructionType",

    /**
     * Decode a stake instruction and retrieve the instruction type.
     */
    value: function decodeInstructionType(instruction) {
      this.checkProgramId(instruction.programId);
      var instructionTypeLayout = u32('instruction');
      var typeIndex = instructionTypeLayout.decode(instruction.data);
      var type;

      for (var _i = 0, _Object$keys = Object.keys(STAKE_INSTRUCTION_LAYOUTS); _i < _Object$keys.length; _i++) {
        var t = _Object$keys[_i];

        if (STAKE_INSTRUCTION_LAYOUTS[t].index == typeIndex) {
          type = t;
        }
      }

      if (!type) {
        throw new Error('Instruction type incorrect; not a StakeInstruction');
      }

      return type;
    }
    /**
     * Decode a initialize stake instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeInitialize",
    value: function decodeInitialize(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 2);

      var _decodeData = decodeData(STAKE_INSTRUCTION_LAYOUTS.Initialize, instruction.data),
          authorized = _decodeData.authorized,
          lockup = _decodeData.lockup;

      return {
        stakePubkey: instruction.keys[0].pubkey,
        authorized: new Authorized(new PublicKey(authorized.staker), new PublicKey(authorized.withdrawer)),
        lockup: new Lockup(lockup.unixTimestamp, lockup.epoch, new PublicKey(lockup.custodian))
      };
    }
    /**
     * Decode a delegate stake instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeDelegate",
    value: function decodeDelegate(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 6);
      decodeData(STAKE_INSTRUCTION_LAYOUTS.Delegate, instruction.data);
      return {
        stakePubkey: instruction.keys[0].pubkey,
        votePubkey: instruction.keys[1].pubkey,
        authorizedPubkey: instruction.keys[5].pubkey
      };
    }
    /**
     * Decode an authorize stake instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeAuthorize",
    value: function decodeAuthorize(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 3);

      var _decodeData2 = decodeData(STAKE_INSTRUCTION_LAYOUTS.Authorize, instruction.data),
          newAuthorized = _decodeData2.newAuthorized,
          stakeAuthorizationType = _decodeData2.stakeAuthorizationType;

      return {
        stakePubkey: instruction.keys[0].pubkey,
        authorizedPubkey: instruction.keys[2].pubkey,
        newAuthorizedPubkey: new PublicKey(newAuthorized),
        stakeAuthorizationType: {
          index: stakeAuthorizationType
        }
      };
    }
    /**
     * Decode an authorize-with-seed stake instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeAuthorizeWithSeed",
    value: function decodeAuthorizeWithSeed(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 2);

      var _decodeData3 = decodeData(STAKE_INSTRUCTION_LAYOUTS.AuthorizeWithSeed, instruction.data),
          newAuthorized = _decodeData3.newAuthorized,
          stakeAuthorizationType = _decodeData3.stakeAuthorizationType,
          authoritySeed = _decodeData3.authoritySeed,
          authorityOwner = _decodeData3.authorityOwner;

      return {
        stakePubkey: instruction.keys[0].pubkey,
        authorityBase: instruction.keys[1].pubkey,
        authoritySeed: authoritySeed,
        authorityOwner: new PublicKey(authorityOwner),
        newAuthorizedPubkey: new PublicKey(newAuthorized),
        stakeAuthorizationType: {
          index: stakeAuthorizationType
        }
      };
    }
    /**
     * Decode a split stake instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeSplit",
    value: function decodeSplit(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 3);

      var _decodeData4 = decodeData(STAKE_INSTRUCTION_LAYOUTS.Split, instruction.data),
          lamports = _decodeData4.lamports;

      return {
        stakePubkey: instruction.keys[0].pubkey,
        splitStakePubkey: instruction.keys[1].pubkey,
        authorizedPubkey: instruction.keys[2].pubkey,
        lamports: lamports
      };
    }
    /**
     * Decode a withdraw stake instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeWithdraw",
    value: function decodeWithdraw(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 5);

      var _decodeData5 = decodeData(STAKE_INSTRUCTION_LAYOUTS.Withdraw, instruction.data),
          lamports = _decodeData5.lamports;

      return {
        stakePubkey: instruction.keys[0].pubkey,
        toPubkey: instruction.keys[1].pubkey,
        authorizedPubkey: instruction.keys[4].pubkey,
        lamports: lamports
      };
    }
    /**
     * Decode a deactivate stake instruction and retrieve the instruction params.
     */

  }, {
    key: "decodeDeactivate",
    value: function decodeDeactivate(instruction) {
      this.checkProgramId(instruction.programId);
      this.checkKeyLength(instruction.keys, 3);
      decodeData(STAKE_INSTRUCTION_LAYOUTS.Deactivate, instruction.data);
      return {
        stakePubkey: instruction.keys[0].pubkey,
        authorizedPubkey: instruction.keys[2].pubkey
      };
    }
    /**
     * @private
     */

  }, {
    key: "checkProgramId",
    value: function checkProgramId(programId) {
      if (!programId.equals(StakeProgram.programId)) {
        throw new Error('invalid instruction; programId is not StakeProgram');
      }
    }
    /**
     * @private
     */

  }, {
    key: "checkKeyLength",
    value: function checkKeyLength(keys, expectedLength) {
      if (keys.length < expectedLength) {
        throw new Error("invalid instruction; found ".concat(keys.length, " keys, expected at least ").concat(expectedLength));
      }
    }
  }]);

  return StakeInstruction;
}();
/**
 * An enumeration of valid StakeInstructionType's
 * @typedef { 'Initialize' | 'Authorize' | 'AuthorizeWithSeed' | 'Delegate' | 'Split' | 'Withdraw'
 | 'Deactivate' } StakeInstructionType
 */

/**
 * An enumeration of valid stake InstructionType's
 */
var STAKE_INSTRUCTION_LAYOUTS = Object.freeze({
  Initialize: {
    index: 0,
    layout: struct([u32('instruction'), authorized(), lockup()])
  },
  Authorize: {
    index: 1,
    layout: struct([u32('instruction'), publicKey('newAuthorized'), u32('stakeAuthorizationType')])
  },
  Delegate: {
    index: 2,
    layout: struct([u32('instruction')])
  },
  Split: {
    index: 3,
    layout: struct([u32('instruction'), ns64('lamports')])
  },
  Withdraw: {
    index: 4,
    layout: struct([u32('instruction'), ns64('lamports')])
  },
  Deactivate: {
    index: 5,
    layout: struct([u32('instruction')])
  },
  AuthorizeWithSeed: {
    index: 8,
    layout: struct([u32('instruction'), publicKey('newAuthorized'), u32('stakeAuthorizationType'), rustString('authoritySeed'), publicKey('authorityOwner')])
  }
});
/**
 * @typedef {Object} StakeAuthorizationType
 * @property (index} The Stake Authorization index (from solana-stake-program)
 */

/**
 * An enumeration of valid StakeAuthorizationLayout's
 */
var StakeAuthorizationLayout = Object.freeze({
  Staker: {
    index: 0
  },
  Withdrawer: {
    index: 1
  }
});
/**
 * Factory class for transactions to interact with the Stake program
 */

var StakeProgram = /*#__PURE__*/function () {
  function StakeProgram() {
    _classCallCheck(this, StakeProgram);
  }

  _createClass(StakeProgram, null, [{
    key: "initialize",

    /**
     * Generate an Initialize instruction to add to a Stake Create transaction
     */
    value: function initialize(params) {
      var stakePubkey = params.stakePubkey,
          authorized = params.authorized,
          lockup = params.lockup;
      var type = STAKE_INSTRUCTION_LAYOUTS.Initialize;
      var data = encodeData(type, {
        authorized: {
          staker: authorized.staker.toBuffer(),
          withdrawer: authorized.withdrawer.toBuffer()
        },
        lockup: {
          unixTimestamp: lockup.unixTimestamp,
          epoch: lockup.epoch,
          custodian: lockup.custodian.toBuffer()
        }
      });
      var instructionData = {
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      };
      return new TransactionInstruction(instructionData);
    }
    /**
     * Generate a Transaction that creates a new Stake account at
     *   an address generated with `from`, a seed, and the Stake programId
     */

  }, {
    key: "createAccountWithSeed",
    value: function createAccountWithSeed(params) {
      var transaction = SystemProgram.createAccountWithSeed({
        fromPubkey: params.fromPubkey,
        newAccountPubkey: params.stakePubkey,
        basePubkey: params.basePubkey,
        seed: params.seed,
        lamports: params.lamports,
        space: this.space,
        programId: this.programId
      });
      var stakePubkey = params.stakePubkey,
          authorized = params.authorized,
          lockup = params.lockup;
      return transaction.add(this.initialize({
        stakePubkey: stakePubkey,
        authorized: authorized,
        lockup: lockup
      }));
    }
    /**
     * Generate a Transaction that creates a new Stake account
     */

  }, {
    key: "createAccount",
    value: function createAccount(params) {
      var transaction = SystemProgram.createAccount({
        fromPubkey: params.fromPubkey,
        newAccountPubkey: params.stakePubkey,
        lamports: params.lamports,
        space: this.space,
        programId: this.programId
      });
      var stakePubkey = params.stakePubkey,
          authorized = params.authorized,
          lockup = params.lockup;
      return transaction.add(this.initialize({
        stakePubkey: stakePubkey,
        authorized: authorized,
        lockup: lockup
      }));
    }
    /**
     * Generate a Transaction that delegates Stake tokens to a validator
     * Vote PublicKey. This transaction can also be used to redelegate Stake
     * to a new validator Vote PublicKey.
     */

  }, {
    key: "delegate",
    value: function delegate(params) {
      var stakePubkey = params.stakePubkey,
          authorizedPubkey = params.authorizedPubkey,
          votePubkey = params.votePubkey;
      var type = STAKE_INSTRUCTION_LAYOUTS.Delegate;
      var data = encodeData(type);
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: votePubkey,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: STAKE_CONFIG_ID,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that authorizes a new PublicKey as Staker
     * or Withdrawer on the Stake account.
     */

  }, {
    key: "authorize",
    value: function authorize(params) {
      var stakePubkey = params.stakePubkey,
          authorizedPubkey = params.authorizedPubkey,
          newAuthorizedPubkey = params.newAuthorizedPubkey,
          stakeAuthorizationType = params.stakeAuthorizationType;
      var type = STAKE_INSTRUCTION_LAYOUTS.Authorize;
      var data = encodeData(type, {
        newAuthorized: newAuthorizedPubkey.toBuffer(),
        stakeAuthorizationType: stakeAuthorizationType.index
      });
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that authorizes a new PublicKey as Staker
     * or Withdrawer on the Stake account.
     */

  }, {
    key: "authorizeWithSeed",
    value: function authorizeWithSeed(params) {
      var stakePubkey = params.stakePubkey,
          authorityBase = params.authorityBase,
          authoritySeed = params.authoritySeed,
          authorityOwner = params.authorityOwner,
          newAuthorizedPubkey = params.newAuthorizedPubkey,
          stakeAuthorizationType = params.stakeAuthorizationType;
      var type = STAKE_INSTRUCTION_LAYOUTS.AuthorizeWithSeed;
      var data = encodeData(type, {
        newAuthorized: newAuthorizedPubkey.toBuffer(),
        stakeAuthorizationType: stakeAuthorizationType.index,
        authoritySeed: authoritySeed,
        authorityOwner: authorityOwner.toBuffer()
      });
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: authorityBase,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that splits Stake tokens into another stake account
     */

  }, {
    key: "split",
    value: function split(params) {
      var stakePubkey = params.stakePubkey,
          authorizedPubkey = params.authorizedPubkey,
          splitStakePubkey = params.splitStakePubkey,
          lamports = params.lamports;
      var transaction = SystemProgram.createAccount({
        fromPubkey: authorizedPubkey,
        newAccountPubkey: splitStakePubkey,
        lamports: 0,
        space: this.space,
        programId: this.programId
      });
      var type = STAKE_INSTRUCTION_LAYOUTS.Split;
      var data = encodeData(type, {
        lamports: lamports
      });
      return transaction.add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: splitStakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that withdraws deactivated Stake tokens.
     */

  }, {
    key: "withdraw",
    value: function withdraw(params) {
      var stakePubkey = params.stakePubkey,
          authorizedPubkey = params.authorizedPubkey,
          toPubkey = params.toPubkey,
          lamports = params.lamports;
      var type = STAKE_INSTRUCTION_LAYOUTS.Withdraw;
      var data = encodeData(type, {
        lamports: lamports
      });
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: toPubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
    /**
     * Generate a Transaction that deactivates Stake tokens.
     */

  }, {
    key: "deactivate",
    value: function deactivate(params) {
      var stakePubkey = params.stakePubkey,
          authorizedPubkey = params.authorizedPubkey;
      var type = STAKE_INSTRUCTION_LAYOUTS.Deactivate;
      var data = encodeData(type);
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data: data
      });
    }
  }, {
    key: "programId",

    /**
     * Public key that identifies the Stake program
     */
    get: function get() {
      return new PublicKey('Stake11111111111111111111111111111111111111');
    }
    /**
     * Max space of a Stake account
     */

  }, {
    key: "space",
    get: function get() {
      return 4008;
    }
  }]);

  return StakeProgram;
}();

var VALIDATOR_INFO_KEY = new PublicKey('Va1idator1nfo111111111111111111111111111111');
/**
 * @private
 */

var InfoString = struct$1({
  name: 'string',
  website: 'string?',
  details: 'string?',
  keybaseUsername: 'string?'
});
/**
 * ValidatorInfo class
 */

var ValidatorInfo = /*#__PURE__*/function () {
  /**
   * validator public key
   */

  /**
   * validator information
   */

  /**
   * Construct a valid ValidatorInfo
   *
   * @param key validator public key
   * @param info validator information
   */
  function ValidatorInfo(key, info) {
    _classCallCheck(this, ValidatorInfo);

    _defineProperty(this, "key", void 0);

    _defineProperty(this, "info", void 0);

    this.key = key;
    this.info = info;
  }
  /**
   * Deserialize ValidatorInfo from the config account data. Exactly two config
   * keys are required in the data.
   *
   * @param buffer config account data
   * @return null if info was not found
   */


  _createClass(ValidatorInfo, null, [{
    key: "fromConfigData",
    value: function fromConfigData(buffer) {
      var PUBKEY_LENGTH = 32;

      var byteArray = _toConsumableArray(buffer);

      var configKeyCount = decodeLength(byteArray);
      if (configKeyCount !== 2) return null;
      var configKeys = [];

      for (var i = 0; i < 2; i++) {
        var publicKey = new PublicKey(byteArray.slice(0, PUBKEY_LENGTH));
        byteArray = byteArray.slice(PUBKEY_LENGTH);
        var isSigner = byteArray.slice(0, 1)[0] === 1;
        byteArray = byteArray.slice(1);
        configKeys.push({
          publicKey: publicKey,
          isSigner: isSigner
        });
      }

      if (configKeys[0].publicKey.equals(VALIDATOR_INFO_KEY)) {
        if (configKeys[1].isSigner) {
          var rawInfo = rustString().decode(Buffer.from(byteArray));
          var info = InfoString(JSON.parse(rawInfo));
          return new ValidatorInfo(configKeys[1].publicKey, info);
        }
      }

      return null;
    }
  }]);

  return ValidatorInfo;
}();

var VOTE_PROGRAM_ID = new PublicKey('Vote111111111111111111111111111111111111111');

/**
 * See https://github.com/solana-labs/solana/blob/8a12ed029cfa38d4a45400916c2463fb82bbec8c/programs/vote_api/src/vote_state.rs#L68-L88
 *
 * @private
 */
var VoteAccountLayout = struct([publicKey('nodePubkey'), publicKey('authorizedVoterPubkey'), publicKey('authorizedWithdrawerPubkey'), u8('commission'), nu64(), // votes.length
seq(struct([nu64('slot'), u32('confirmationCount')]), offset(u32(), -8), 'votes'), u8('rootSlotValid'), nu64('rootSlot'), nu64('epoch'), nu64('credits'), nu64('lastEpochCredits'), nu64(), // epochCredits.length
seq(struct([nu64('epoch'), nu64('credits'), nu64('prevCredits')]), offset(u32(), -8), 'epochCredits')]);
/**
 * VoteAccount class
 */

var VoteAccount = /*#__PURE__*/function () {
  function VoteAccount() {
    _classCallCheck(this, VoteAccount);

    _defineProperty(this, "nodePubkey", void 0);

    _defineProperty(this, "authorizedVoterPubkey", void 0);

    _defineProperty(this, "authorizedWithdrawerPubkey", void 0);

    _defineProperty(this, "commission", void 0);

    _defineProperty(this, "votes", void 0);

    _defineProperty(this, "rootSlot", void 0);

    _defineProperty(this, "epoch", void 0);

    _defineProperty(this, "credits", void 0);

    _defineProperty(this, "lastEpochCredits", void 0);

    _defineProperty(this, "epochCredits", void 0);
  }

  _createClass(VoteAccount, null, [{
    key: "fromAccountData",

    /**
     * Deserialize VoteAccount from the account data.
     *
     * @param buffer account data
     * @return VoteAccount
     */
    value: function fromAccountData(buffer) {
      var va = VoteAccountLayout.decode(toBuffer(buffer), 0);
      va.nodePubkey = new PublicKey(va.nodePubkey);
      va.authorizedVoterPubkey = new PublicKey(va.authorizedVoterPubkey);
      va.authorizedWithdrawerPubkey = new PublicKey(va.authorizedWithdrawerPubkey);

      if (!va.rootSlotValid) {
        va.rootSlot = null;
      }

      return va;
    }
  }]);

  return VoteAccount;
}();

/**
 * Send and confirm a raw transaction
 *
 * If `confirmations` count is not specified, wait for transaction to be finalized.
 *
 * @param {Connection} connection
 * @param {Buffer} rawTransaction
 * @param {ConfirmOptions} [options]
 * @returns {Promise<TransactionSignature>}
 */
function sendAndConfirmRawTransaction(_x, _x2, _x3) {
  return _sendAndConfirmRawTransaction.apply(this, arguments);
}

function _sendAndConfirmRawTransaction() {
  _sendAndConfirmRawTransaction = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime.mark(function _callee(connection, rawTransaction, options) {
    var start, signature, status, duration;
    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            start = Date.now();
            _context.next = 3;
            return connection.sendRawTransaction(rawTransaction, options);

          case 3:
            signature = _context.sent;
            _context.next = 6;
            return connection.confirmTransaction(signature, options && options.confirmations);

          case 6:
            status = _context.sent.value;

            if (!status) {
              _context.next = 11;
              break;
            }

            if (!status.err) {
              _context.next = 10;
              break;
            }

            throw new Error("Raw transaction ".concat(signature, " failed (").concat(JSON.stringify(status), ")"));

          case 10:
            return _context.abrupt("return", signature);

          case 11:
            duration = (Date.now() - start) / 1000;
            throw new Error("Raw transaction '".concat(signature, "' was not confirmed in ").concat(duration.toFixed(2), " seconds"));

          case 13:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));
  return _sendAndConfirmRawTransaction.apply(this, arguments);
}

/**
 * @private
 */
var endpoint = {
  http: {
    devnet: 'http://devnet.solana.com',
    testnet: 'http://testnet.solana.com',
    'mainnet-beta': 'http://api.mainnet-beta.solana.com'
  },
  https: {
    devnet: 'https://devnet.solana.com',
    testnet: 'https://testnet.solana.com',
    'mainnet-beta': 'https://api.mainnet-beta.solana.com'
  }
};

/**
 * Retrieves the RPC API URL for the specified cluster
 */
function clusterApiUrl(cluster, tls) {
  var key = tls === false ? 'http' : 'https';

  if (!cluster) {
    return endpoint[key]['devnet'];
  }

  var url = endpoint[key][cluster];

  if (!url) {
    throw new Error("Unknown ".concat(key, " cluster: ").concat(cluster));
  }

  return url;
}

/**
 * There are 1-billion lamports in one SOL
 */

var LAMPORTS_PER_SOL = 1000000000;

export { Account, Authorized, BpfLoader, Connection, LAMPORTS_PER_SOL, Loader, Lockup, Message, NONCE_ACCOUNT_LENGTH, NonceAccount, PublicKey, STAKE_CONFIG_ID, STAKE_INSTRUCTION_LAYOUTS, SYSTEM_INSTRUCTION_LAYOUTS, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, SYSVAR_REWARDS_PUBKEY, SYSVAR_STAKE_HISTORY_PUBKEY, StakeAuthorizationLayout, StakeInstruction, StakeProgram, SystemInstruction, SystemProgram, Transaction, TransactionInstruction, VALIDATOR_INFO_KEY, VOTE_PROGRAM_ID, ValidatorInfo, VoteAccount, clusterApiUrl, sendAndConfirmRawTransaction, sendAndConfirmTransaction };
//# sourceMappingURL=index.esm.js.map
