# Sidekick

[![Build Status](https://travis-ci.org/sidekickcode/sidekick.svg?branch=master)](https://travis-ci.org/sidekickcode/sidekick)

Sidekick - your code, made perfect.

## Pre-requisites

We need `git` to be installed on your machine.


## Installation

```sh
npm i sidekick -g
```

## Initialisation

Sidekick does not ship with any analysers, so you will need to install them. Its really easy to do:

```sh
sidekick analysers --install
```

You can check that your system is configured correctly:

```sh
sidekick config
```

If `git` is not available on your path, then you will need to tell us where it has been installed to:

```sh
sidekick config --git=/some/path/to/git
```


## Usage

###You can run Sidekick on your CI server:

```sh
sidekick run --ci
```

This will install all the analysers that are needed, run them against your code and optionally fail the build.

#### Travis integration

```sh
sidekick run --travis
```

Will analyse just the changes that prompted the travis build. This is great for analysing Pull Requests with
just 2 lines of config!

###You can run Sidekick against code on your machine:

```sh
cd your/repo
sidekick run
```

or

```sh
sidekick run path/to/your/repo
```

This will evaluate the working copy of the repo's code on your machine.

You can use `--compare` and `--versus` cli arguments to compare your working copy with other local or remote branches.

###You can configure how sidekick analyses your files

By default, we look at the contents of your repo and run analysers that we think will be useful, e.g. if we find
JavaScript files, we will run a JavaScript TODO/FIXME finder, if we find a `package.json` file, we will run our
`david-dm` analyser on your dependencies..

You can add a `.sidekickrc` file to your repo to tell us what analysers you would like to run, and which ones can
fail the build. To create a default `.sidekickrc` file:

```sh
sidekick init
```

## Git push integration and GUI

Sidekick also has a git pre-push hook and a GUI that helps you fix your issues before they are pushed to a remote repo.
 
This GUI is in beta at the moment.

If you want to get support then we have a [chat room](https://gitter.im/sidekickcode/support).
If you want to raise issues then you can do so [here](https://github.com/sidekickcode/tracker/issues).

Thanks for trying Sidekick.
