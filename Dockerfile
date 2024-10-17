FROM docker.io/denoland/deno:2.0.0

WORKDIR /app

COPY . .

RUN deno install

# Expose the port that Deno will listen to
EXPOSE 80

# Command to run the application
CMD ["run", "-A", "main.ts"]
