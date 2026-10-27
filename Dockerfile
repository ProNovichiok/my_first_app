FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml ./
COPY src ./src
COPY public ./public
COPY config ./config
RUN mvn -B verify
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --gid 1000 rental && useradd --uid 1000 --gid 1000 --no-create-home rental
COPY --from=build --chown=rental:rental /app/target/baltic-drive.jar /app/baltic-drive.jar
COPY --chown=rental:rental config ./config
COPY --chown=rental:rental .env.example ./
USER rental
EXPOSE 3000
ENTRYPOINT ["java","-jar","baltic-drive.jar"]
