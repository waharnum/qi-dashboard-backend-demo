#!/bin/sh -e

if [ "$CONTAINER_TEST" = true ]; then
    ansible-playbook docker.yml --tags "deploy" && \
    ansible-playbook docker.yml --tags "test"
else
    ansible-playbook docker.yml --tags "deploy" && \
    supervisord -n -c /etc/supervisord.conf
fi
