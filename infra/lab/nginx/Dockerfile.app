ARG LAB_PROFILE=exposed
FROM nginx:1.27
ARG LAB_PROFILE
ENV OPENSSL_CONF=/etc/nginx/openssl-legacy.cnf
COPY openssl-legacy.cnf /etc/nginx/openssl-legacy.cnf
COPY app/${LAB_PROFILE}/default.conf /etc/nginx/conf.d/default.conf
