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

###You can run Sidekick against code on your machine:

```sh
cd your/repo
sidekick run
```
This will evaluate the working copy of the repo's code on your machine.
You can use `--compare` and `--versus` cli arguments to compare your working copy with other local or remote branches.

## GUI

Sidekick also has a GUI that helps you fix your issues before they are pushed to a remote repo. This GUI is in beta at the moment.
Please go to [our web site](https://sidekickcode.com) to sign up for the beta.

Thanks for trying Sidekick.
