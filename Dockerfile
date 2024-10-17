FROM docker.io/denoland/deno:2.0.0

WORKDIR /app

COPY . .

RUN deno install

RUN addgroup appgroup 
RUN adduser --home /home/application --disabled-password application
RUN adduser application appgroup
RUN chown -R application:appgroup /app
USER application

EXPOSE 80

CMD ["run", "-A", "main.ts"]
