# Record from the repo root: vhs tapes/nocturne.tape
# Runs the repo's own code (bun nocturne.ts) in --sim mode, so it needs no
# audio, no fixture, and touches nothing personal. Shot at the ghostty
# settings below (Cascadia Code NF 19, spider-verse swatch theme); re-render
# whenever the TUI's output changes.

Output .github/assets/nocturne.gif

Set FontFamily "Cascadia Code NF"
Set FontSize 19
Set Padding 12
Set Width 1200
Set Height 760
Set TypingSpeed 50ms
Set Framerate 30
Set Theme { "background": "#0d0a1e", "foreground": "#ece9f7", "cursor": "#ff1f6b", "selection": "#272049", "black": "#1b1638", "red": "#b01c18", "green": "#2fbf7a", "yellow": "#d99a12", "blue": "#6b4fd6", "magenta": "#d6155a", "cyan": "#00a8cc", "white": "#c9c4dd", "brightBlack": "#5c5480", "brightRed": "#ff473c", "brightGreen": "#3dffa8", "brightYellow": "#ffc93c", "brightBlue": "#8b6cff", "brightMagenta": "#ff1f6b", "brightCyan": "#00d4ff", "brightWhite": "#ece9f7" }

Hide
Type "nocturne() { bun $PWD/nocturne.ts $@; }; export PS1='❯ '; clear"
Enter
Sleep 500ms
Show

Type "nocturne --sim --seed 42"
Sleep 500ms
Enter
Sleep 8s
Type "q"
Sleep 500ms
