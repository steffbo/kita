# Errors
## eventmachine 1.2.7 fails to install on MacOS Tahoe 26+
```
An error occurred while installing eventmachine (1.2.7), and Bundler cannot continue.

In Gemfile:
  beautiful-jekyll-theme was resolved to 6.0.1, which depends on
    jekyll-sitemap was resolved to 1.4.0, which depends on
      jekyll was resolved to 4.4.1, which depends on
        em-websocket was resolved to 0.5.3, which depends on
          eventmachine
```
### Fix
* Uninstall xcode developer tools
```shell
sudo rm -rf /Library/Developer/CommandLineTools
```
* Install xcode developer tools
```shell
xcode-select --install
```
* This will open a popup, confirm installation
* After installation is complete, install ruby again
```shell
mise install ruby@3.4.5
```
* Make sure you use the correct ruby version
```shell
ruby -v
```
* In case the version is not correct, add this to the end of ~/.zshrc
```
eval "$(mise activate zsh)"
```