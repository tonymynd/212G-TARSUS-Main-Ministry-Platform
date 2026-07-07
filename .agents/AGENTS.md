# Project Agent Rules

## Shell Commands and Working Directory
Because the user's PowerShell profile resets the current working directory to `C:\aENTRADA` on startup, **you must explicitly `cd` into the project root** whenever you use the `run_command` tool.

Project Root: `c:\STORAGE\M\Manifold-Grace\1-PROJECTS(Stove)\212G-TARSUS-Main-Ministry-Platform`

Example:
```powershell
cd 'c:\STORAGE\M\Manifold-Grace\1-PROJECTS(Stove)\212G-TARSUS-Main-Ministry-Platform'; git status
```
Failure to do this will result in commands like `git` running in the wrong directory and failing.
