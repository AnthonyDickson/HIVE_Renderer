# WebXR 360 Degree Video Demo
## Getting Started
```shell
git clone https://github.com/eight0153/depth-from-mono-demo
cd depth-from-mono-demo
npm install
npm start
```

## Updating the GitHub Page
1. Run the following commands after updating the page on the main branch.
    ```shell
    git checkout gh-pages # Change to the branch that GitHub uses
    git merge master # Copy changes from the main branch. 
    npm build
    # Built files must be copied to the dir that GitHub is setup to use (I use root/ in this example).
    cp -r dist/* .
    # Add the new javascript files
    git add index* 
    # (Optional) if you added video
    git add video/*
    git commit -m "Your commit message here"
    git push
    ```
2. Reload \<GitHub Username>.github.io/\<Repository name> and it should show the updated contents.
