{
  description = "bun-bunsai - LocalStack-equivalent AWS API emulator in Bun";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      imports = [
        inputs.treefmt-nix.flakeModule
      ];

      perSystem =
        { pkgs, ... }:
        {
          treefmt = {
            projectRootFile = "flake.nix";
            programs.prettier.enable = true;
            programs.nixfmt.enable = true;
            settings.global.excludes = [ "test/vendor/**" ];
          };

          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              git
              gh
              jq
            ];
          };
        };
    };
}
