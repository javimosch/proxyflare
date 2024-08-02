#!/bin/bash

# Load settings from deploy.json if it exists
if [ -f deploy.json ]; then
  . deploy.json
else
  # First-time setup: prompt user for settings
  read -p "Enter your SSH user@host: " SSH_USER_HOST
  read -p "Enter the remote base path (e.g. /home/user/projects): " REMOTE_BASE_PATH

  # Save settings to deploy.json
  echo "SSH_USER_HOST=\"$SSH_USER_HOST\"" > deploy.json
  echo "REMOTE_BASE_PATH=\"$REMOTE_BASE_PATH\"" >> deploy.json
fi

NAME=""
while getopts ":n:" opt; do
  case $opt in
    n) NAME="$OPTARG";;
    \?) echo "Invalid option: -$OPTARG"; exit 1;;
  esac
done

if [ -z "$NAME" ]; then
  # Load project name from deploy.json if available
  if [ -n "$PROJECT_NAME" ]; then
    NAME="$PROJECT_NAME"
  else
    # Prompt user for project name
    read -p "Enter your project name: " NAME
    echo "PROJECT_NAME=\"$NAME\"" >> deploy.json
  fi
fi

echo "Deploying to $REMOTE_BASE_PATH/$NAME"

ssh $SSH_USER_HOST "mkdir -p $REMOTE_BASE_PATH/$NAME"

rsync -avz --exclude 'deploy.sh' --exclude 'node_modules' --exclude '.env' --include '.env.prod' . $SSH_USER_HOST:$REMOTE_BASE_PATH/$NAME

# Check if docker-compose.yml file exists
if ssh $SSH_USER_HOST "test -f $REMOTE_BASE_PATH/$NAME/docker-compose.yml"; then
  PS3="Please select an action: "
  options=("Restart" "Up in detached mode" "Force recreate" "Force recreate and build" "Exit")
  select opt in "${options[@]}"; do
    case $opt in
      "Restart")
        read -p "Are you sure you want to restart the containers? (y/n): " RESPONSE
        if [[ $RESPONSE =~ ^[yY]$ ]]; then
          ssh $SSH_USER_HOST "cd $REMOTE_BASE_PATH/$NAME && docker-compose restart"
        fi
        break
        ;;
      "Up in detached mode")
        read -p "Are you sure you want to start in detached mode? (y/n): " RESPONSE
        if [[ $RESPONSE =~ ^[yY]$ ]]; then
          ssh $SSH_USER_HOST "cd $REMOTE_BASE_PATH/$NAME && docker-compose up -d"
        fi
        break
        ;;
      "Force recreate")
        read -p "Are you sure you want to force recreate the containers? (y/n): " RESPONSE
        if [[ $RESPONSE =~ ^[yY]$ ]]; then
          ssh $SSH_USER_HOST "cd $REMOTE_BASE_PATH/$NAME && docker-compose up -d --force-recreate"
        fi
        break
        ;;
      "Force recreate and build")
        read -p "Are you sure you want to force recreate and build the containers? (y/n): " RESPONSE
        if [[ $RESPONSE =~ ^[yY]$ ]]; then
          ssh $SSH_USER_HOST "cd $REMOTE_BASE_PATH/$NAME && docker-compose build --no-cache && docker-compose up -d --force-recreate"
        fi
        break
        ;;
      "Exit")
        echo "Exiting..."
        exit 0
        ;;
      *) 
        echo "Invalid option. Please try again." 
        ;;
    esac
  done
fi