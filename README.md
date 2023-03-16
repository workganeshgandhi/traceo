# Traceo
Traceo is an open-source, self-hosted set of tools for monitoring application health by collecting and aggregating data from the software. 

# Development status
Not ready for production use.

# SDK
To start using the Traceo platform, you need to integrate with [Traceo SDK](https://github.com/traceo-io/traceo-node). Informations about the process of implementation SDK inside your software is in README of the each SDK.
- [`@traceo-sdk/node`](https://github.com/traceo-dev/traceo-sdk/tree/develop/packages/node): SDK for NodeJS.
- [`@traceo-sdk/react`](https://github.com/traceo-dev/traceo-sdk/tree/develop/packages/react): SDK for ReactJS.


# Installation
At this point, the installation of the Traceo platform is done by using the docker image.

To pull or run already existing docker image:
```
docker run -d --name=traceo -p 3000:3000 traceo/traceo
```

The application will be available at http://localhost:3000.

The default user is `admin/admin`. 

If you want to use a custom `port` then you should use:
```
docker run -d --name=traceo -p <port>:3000 traceo/traceo
```

### ***Database***
By default, Traceo Platform uses the SQLite database. Once the container is stopped, all your data will be deleted. To avoid this, create a docker volume and mount it at application startup.
```
docker volume create traceo-volume

docker run -d --name=traceo -v traceo-volume:/usr/traceo -p 3000:3000 traceo/traceo
```


If you want to integrate with the PostgreSQL database you have to set the environment variables as below:

```
docker run \
  -d -p 3000:3000 \
  -e PG_HOST="POSTGRES_HOST" \
  -e PG_PORT="POSTGRES_PORT" \
  -e PG_DB_NAME="POSTGRSES_DB_NAME" \
  -e PG_PASS="POSTGRES_PASSWORD" \
  -e PG_USER="POSTGRES_USER" \
  --name=traceo \
  traceo/traceo
```
# Features
### ***Incidents capture***
With our SDK we can capture all exceptions and errors occurs in your software. Each incident is unique and if another incident of the same type occurs, then it is grouped with the first one. 

<img src="https://github.com/traceo-io/traceo/raw/develop/.github/screenshots/traceo-incident-preview.PNG">

### ***Logs analysis***
You can monitor all the important and sensitive places in your software, recording the relevant information, which is then sent to Traceo so that you can later efficiently search for the information you need.

<img src="https://github.com/traceo-io/traceo/raw/develop/.github/screenshots/traceo-logs.PNG">

### ***Metrics***
Metrics are a set of data taken from a given source, correlated with the time of their occurrence. In Traceo, metrics are used to record data about the software your application runs on, including CPU usage, memory usage, RSS, and more. .

<img src="https://github.com/traceo-io/traceo/raw/develop/.github/screenshots/traceo-metrics.PNG">

# Support

Feel free to create Issues, Pull Request or Discussions.

# License

Traceo is licensed under the [Apache License, Version 2.0](https://github.com/traceo-dev/traceo/blob/main/LICENSE).
