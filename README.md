# QI Dashboard Backend Demo

This repository contains a prototype of the backend service meant to be used to demo the QI Dashboard. 

## Requirements

You will need to:

* Meet some basic [Vagrant requirements](https://github.com/GPII/qi-development-environments/#requirements)

* [Generate a GitHub personal access token](https://github.com/settings/tokens/new) and provide it in your ``provisioning/secrets.yml`` file. No scopes need to be selected on the token generation page.

## Use a VM

Typing ``vagrant up`` will download a [CentOS 7 VM](https://atlas.hashicorp.com/inclusivedesign/boxes/centos7) and deploy the service. 

## Use a container

The same VM mentioned above can be used to build a Docker image and run containers.

### Build an image

    sudo docker build -t avtar/qi-dashboard-backend .

### Run a container

```
sudo docker run \
-d \ 
-p 3000:3000 \
--name="qi-dashboard-backend" \
-e QI_DASHBOARD_BACKEND_TCP_PORT=3000 \
-e GITHUB_PERSONAL_ACCESS_TOKEN=<your token here> \ 
avtar/qi-dashboard-backend
```

Adding a ``-e CONTAINER_TEST=true`` option will test the running service. The test requires internet access since a request is made to a GitHub API endpoint.