#!/usr/bin/env bash


usage() {
    cat <<EOF

Usage: do.sh rust_project_directory action 

Supported actions:
    build <name_of_project> <rename_so_path>
    clean
    test
    clippy
    fmt

EOF
}

if [ -z "$1" ]; then
    usage
    exit
fi

cd "$(dirname $0)/$1"

sdkDir=../../node_modules/@solana/web3.js/bpf-sdk
targetDir=../target
profile=bpfel-unknown-unknown/release

perform_action() {
    set -e
    case "$2" in
    build)
        "$sdkDir"/rust/build.sh "$PWD"
        
        so_path="$targetDir/$profile"

        if [ -z "$3" ]; then
            usage
            exit
        fi

        so_name="$3"

        if [ -z "$4" ]; then
            usage
            exit
        fi

        dest="$4"

        if [ -f "$so_path/${so_name}.so" ]; then
            cp "$so_path/${so_name}.so" "$so_path/${so_name}_debug.so"
            "$sdkDir"/dependencies/llvm-native/bin/llvm-objcopy --strip-all "$so_path/${so_name}.so" "$so_path/$so_name.so"
        fi

        mkdir -p ../../dist/program
        cp "$so_path/${so_name}.so" "$dest"
        ;;
    clean)
        "$sdkDir"/rust/clean.sh "$PWD"
        ;;
    test)
        echo "test"
        shift
        cargo +nightly test $@
        ;;
    clippy)
        echo "clippy"
        cargo +nightly clippy
        ;;
    fmt)
        echo "formatting"
        cargo fmt
        ;;
    dump)
        # Dump depends on tools that are not installed by default and must be installed manually
        # - greadelf
        # - rustfilt
        (
            pwd
            "$0" build

            if [ -z "$2" ]; then
                usage
                exit
            fi

            so_name="$2"

            so_path="$targetDir/$profile"
            so="$so_path/${so_name}_debug.so"
            dump="$so_path/${so_name}-dump"

            if [ -f "$so" ]; then
                ls \
                    -la \
                    "$so" \
                    >"${dump}-mangled.txt"
                greadelf \
                    -aW \
                    "$so" \
                    >>"${dump}-mangled.txt"
                "$sdkDir/dependencies/llvm-native/bin/llvm-objdump" \
                    -print-imm-hex \
                    --source \
                    --disassemble \
                    "$so" \
                    >>"${dump}-mangled.txt"
                sed \
                    s/://g \
                    < "${dump}-mangled.txt" \
                    | rustfilt \
                    > "${dump}.txt"
            else
                echo "Warning: No dump created, cannot find: $so"
            fi
        )
        ;;
    help)
        usage
        exit
        ;;
    *)
        echo "Error: Unknown command"
        usage
        exit
        ;;
    esac
}

set -e

perform_action "$@"
