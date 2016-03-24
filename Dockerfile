FROM inclusivedesign/nodejs:4.3.1

WORKDIR /etc/ansible/playbooks

COPY provisioning/* /etc/ansible/playbooks/

ENV INSTALL_DIR=/opt/qi-dashboard-backend

ENV EXTRA_VARS_FILE=docker-vars.yml

COPY . $INSTALL_DIR

RUN ansible-playbook docker.yml --tags "install,configure"

COPY provisioning/start.sh /usr/local/bin/start.sh

RUN chmod 755 /usr/local/bin/start.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/start.sh"]