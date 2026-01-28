okay. you should implement testing now

1) spawn new agent to create testing plan. You should use distrobox (installed) with ./distrobox.ini config I added (via distrobox-assemble to create from config). Use opencode cli to start opencode non interactively and check if there are any issues https://opencode.ai/docs/cli/, also use `opencode debug`, eg `opencode debug config`. Tests planning agent should research related docs, check distrobox and opencode cli docs and verify that cli commands will work actually
2) spawn test plan tester agent. it should do quick test of proposed actions: that commands work, infra tools do not error, opencode picks ai provider and model and can answer basic questions non interactively, plan can be actually implemented. It fixes the plan in case of any issues or reports and stops if smth is broken and not implentable
3) than spawn actual tester agent that will setup opencode, setup the provider, run some test non-interactive sessions, ensure that plugin is intalled correctly and handles all test cases fine, creates a report with found issues
4) all found issues are passed to fixer agent who checks actual implementations
5) tester and fixer iterate untill everything works fine or there is unrecoverable error

tips: 
- to cleanup between test attempts, rm home dir of distrobox container, see the config ini
- to publish new version to npm, use NPM_TOKEN from .env and do `export NPM_TOKEN=xxx && npm publish`
- to power opencode with ai model, use "z ai coding plan" provider, see actual token in .env, check docs to understand how to setup provider and model properly
- use `distrobox enter fedora-dev-tmp -- commandhere` to run smth and `distrobox assemble create --replace` to recreate container (this not cleans container's home)
