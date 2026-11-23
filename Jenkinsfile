
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        DOCKERHUB_USER = 'udaynaik07'
        APP_IMAGE = 'udaynaik07/capstone-2'
        NODE_IMAGE = 'node:20-bookworm-slim'
    }

    parameters {
        booleanParam(
            name: 'PUSH',
            defaultValue: true,
            description: 'Push image to Docker Hub'
        )
        booleanParam(
            name: 'DEPLOY',
            defaultValue: false,
            description: 'Deploy using Docker Compose'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Source code checked out automatically by Jenkins'
            }
        }

        stage('Backend Install and Test') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    docker run --rm `
                      --mount "type=bind,source=$env:WORKSPACE\\Website\\backend,target=/app" `
                      -w /app `
                      $env:NODE_IMAGE `
                      sh -c "npm ci && npm test"

                    if ($LASTEXITCODE -ne 0) {
                        throw "Backend tests failed"
                    }
                '''
            }
        }

        stage('Frontend Install and Build') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    docker run --rm `
                      --mount "type=bind,source=$env:WORKSPACE\\Website\\frontend,target=/app" `
                      -w /app `
                      $env:NODE_IMAGE `
                      sh -c "npm ci && npm run build"

                    if ($LASTEXITCODE -ne 0) {
                        throw "Frontend build failed"
                    }
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    docker build `
                      -f Dockerfile `
                      -t "$env:APP_IMAGE:$env:BUILD_NUMBER" `
                      .

                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker image build failed"
                    }
                '''
            }
        }

        stage('Push to Docker Hub') {
            when {
                expression { params.PUSH }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-cred',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    powershell '''
                        $ErrorActionPreference = "Stop"

                        $env:DOCKER_PASS | docker login `
                          -u $env:DOCKER_USER `
                          --password-stdin

                        if ($LASTEXITCODE -ne 0) {
                            throw "Docker login failed"
                        }

                        docker push "$env:APP_IMAGE:$env:BUILD_NUMBER"

                        if ($LASTEXITCODE -ne 0) {
                            throw "Docker push failed"
                        }

                        docker logout
                    '''
                }
            }
        }

        stage('Deploy') {
            when {
                expression { params.DEPLOY }
            }
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    if (!(Test-Path ".env")) {
                        throw ".env file not found in workspace"
                    }

                    $env:IMAGE_TAG = $env:BUILD_NUMBER

                    docker compose -f docker-compose.yml up -d --remove-orphans

                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker Compose deployment failed"
                    }

                    docker compose -f docker-compose.yml ps
                '''
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }

        failure {
            echo 'Pipeline failed. Check the console output.'
        }

        always {
            powershell '''
                docker image ls | Select-String "capstone-2"
            '''
            cleanWs(deleteDirs: true, notFailBuild: true)
        }
    }
}
