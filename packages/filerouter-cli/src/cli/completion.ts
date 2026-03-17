/**
 * Generate shell completion scripts for filerouter-cli
 */
export function generateCompletion(shell?: string): void {
  if (!shell) {
    console.log(`
Usage: filerouter-cli completion <shell>

Supported shells:
  bash    Bash completion script
  zsh     Zsh completion script
  fish    Fish completion script

Installation:

  Bash (add to ~/.bashrc):
    eval "$(filerouter-cli completion bash)"
    # or
    filerouter-cli completion bash >> ~/.bashrc

  Zsh (add to ~/.zshrc):
    eval "$(filerouter-cli completion zsh)"
    # or
    filerouter-cli completion zsh >> ~/.zshrc

  Fish (save to completions directory):
    filerouter-cli completion fish > ~/.config/fish/completions/filerouter-cli.fish
`);
    return;
  }

  switch (shell.toLowerCase()) {
    case "bash":
      console.log(generateBashCompletion());
      break;
    case "zsh":
      console.log(generateZshCompletion());
      break;
    case "fish":
      console.log(generateFishCompletion());
      break;
    default:
      console.error(`Unknown shell: ${shell}`);
      console.error("Supported shells: bash, zsh, fish");
      process.exit(1);
  }
}

function generateBashCompletion(): string {
  return `# filerouter-cli bash completion
# Add to ~/.bashrc: eval "$(filerouter-cli completion bash)"

_filerouter_cli_completions() {
    local cur prev words cword
    _init_completion || return

    local commands="init dev generate completion"
    local global_opts="-h --help -v --version"
    local common_opts="-c --commands -o --output -n --name"

    case "\${prev}" in
        filerouter-cli)
            COMPREPLY=($(compgen -W "\${commands} \${global_opts}" -- "\${cur}"))
            return 0
            ;;
        init)
            # Complete directory names for project name
            COMPREPLY=($(compgen -d -- "\${cur}"))
            return 0
            ;;
        dev|generate)
            COMPREPLY=($(compgen -W "\${common_opts}" -- "\${cur}"))
            return 0
            ;;
        completion)
            COMPREPLY=($(compgen -W "bash zsh fish" -- "\${cur}"))
            return 0
            ;;
        -c|--commands)
            # Complete directories
            COMPREPLY=($(compgen -d -- "\${cur}"))
            return 0
            ;;
        -o|--output)
            # Complete files
            COMPREPLY=($(compgen -f -- "\${cur}"))
            return 0
            ;;
        -n|--name)
            # No completion for name
            return 0
            ;;
    esac

    # Default to commands and global options
    COMPREPLY=($(compgen -W "\${commands} \${global_opts}" -- "\${cur}"))
}

complete -F _filerouter_cli_completions filerouter-cli
`;
}

function generateZshCompletion(): string {
  return `#compdef filerouter-cli
# filerouter-cli zsh completion
# Add to ~/.zshrc: eval "$(filerouter-cli completion zsh)"

_filerouter_cli() {
    local -a commands
    local -a global_opts
    
    commands=(
        'init:Create a new filerouter-cli project'
        'dev:Start interactive dev mode with hot reload'
        'generate:Generate commandsTree.gen.ts'
        'completion:Generate shell completion scripts'
    )
    
    global_opts=(
        '(-h --help)'{-h,--help}'[Show help message]'
        '(-v --version)'{-v,--version}'[Show version]'
    )
    
    local -a common_opts
    common_opts=(
        '(-c --commands)'{-c,--commands}'[Commands directory]:directory:_directories'
        '(-o --output)'{-o,--output}'[Output file]:file:_files'
        '(-n --name)'{-n,--name}'[CLI name]:name:'
    )

    _arguments -C \\
        "\${global_opts[@]}" \\
        '1:command:->command' \\
        '*::arg:->args'

    case "$state" in
        command)
            _describe -t commands 'filerouter-cli commands' commands
            ;;
        args)
            case "$words[1]" in
                init)
                    _arguments \\
                        '1:project name:_directories' \\
                        "\${common_opts[@]}"
                    ;;
                dev|generate)
                    _arguments "\${common_opts[@]}"
                    ;;
                completion)
                    local -a shells
                    shells=('bash' 'zsh' 'fish')
                    _describe -t shells 'shells' shells
                    ;;
            esac
            ;;
    esac
}

_filerouter_cli "$@"
`;
}

function generateFishCompletion(): string {
  return `# filerouter-cli fish completion
# Save to ~/.config/fish/completions/filerouter-cli.fish

# Disable file completion by default
complete -c filerouter-cli -f

# Commands
complete -c filerouter-cli -n "__fish_use_subcommand" -a "init" -d "Create a new filerouter-cli project"
complete -c filerouter-cli -n "__fish_use_subcommand" -a "dev" -d "Start interactive dev mode with hot reload"
complete -c filerouter-cli -n "__fish_use_subcommand" -a "generate" -d "Generate commandsTree.gen.ts"
complete -c filerouter-cli -n "__fish_use_subcommand" -a "completion" -d "Generate shell completion scripts"

# Global options
complete -c filerouter-cli -s h -l help -d "Show help message"
complete -c filerouter-cli -s v -l version -d "Show version"

# Common options for dev and generate
complete -c filerouter-cli -n "__fish_seen_subcommand_from dev generate" -s c -l commands -d "Commands directory" -r -a "(__fish_complete_directories)"
complete -c filerouter-cli -n "__fish_seen_subcommand_from dev generate" -s o -l output -d "Output file" -r -F
complete -c filerouter-cli -n "__fish_seen_subcommand_from dev generate" -s n -l name -d "CLI name" -r

# init command
complete -c filerouter-cli -n "__fish_seen_subcommand_from init" -s n -l name -d "CLI name" -r
complete -c filerouter-cli -n "__fish_seen_subcommand_from init" -a "(__fish_complete_directories)" -d "Project directory"

# completion subcommands
complete -c filerouter-cli -n "__fish_seen_subcommand_from completion" -a "bash" -d "Bash completion"
complete -c filerouter-cli -n "__fish_seen_subcommand_from completion" -a "zsh" -d "Zsh completion"
complete -c filerouter-cli -n "__fish_seen_subcommand_from completion" -a "fish" -d "Fish completion"
`;
}
