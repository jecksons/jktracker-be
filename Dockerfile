FROM  node

WORKDIR  /usr/app

COPY  package.json   /usr/app/  

RUN npm install

COPY  .  .

ENV   WEB_PORT 9050
ENV   DB_PORT  3306
ENV   DB_USER  jktracker
ENV   DB_NAME  jktracker
ENV   TZ America/Sao_Paulo

EXPOSE   $WEB_PORT

CMD   ["npm", "start"]