
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        DOCKERHUB_USER = 'udaynaik07'
        APP_IMAGE      = 'udaynaik07/capstone-2'
        NODE_IMAGE     = 'node:20-bookworm-slim'
    }

    parameters {
        booleanParam(
            name: 'PUSH',
            defaultValue: true,
            description: 'Push Docker image to Docker Hub'
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
                echo 'Source code checked out by Jenkins'
            }
        }

        stage('Verify Docker') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    docker --version
                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker is not available"
                    }

                    docker info
                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker daemon is not running or accessible"
                    }
                '''
            }
        }

        stage('Backend Install and Test') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    $backendPath = Join-Path $env:WORKSPACE "Website\\backend"

                    if (!(Test-Path $backendPath)) {
                        throw "Backend directory not found: $backendPath"
                    }

                    docker run --rm `
                        --mount "type=bind,source=$backendPath,target=/app" `
                        -w /app `
                        $env:NODE_IMAGE `
                        sh -c "npm ci && npm test"

                    if ($LASTEXITCODE -ne 0) {
                        throw "Backend installation or tests failed"
                    }
                '''
            }
        }

        stage('Frontend Install and Build') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    $frontendPath = Join-Path $env:WORKSPACE "Website\\frontend"

                    if (!(Test-Path $frontendPath)) {
                        throw "Frontend directory not found: $frontendPath"
                    }

                    docker run --rm `
                        --mount "type=bind,source=$frontendPath,target=/app" `
                        -w /app `
                        $env:NODE_IMAGE `
                        sh -c "npm ci && npm run build"

                    if ($LASTEXITCODE -ne 0) {
                        throw "Frontend installation or build failed"
                    }
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    $imageTag = "$($env:APP_IMAGE):$($env:BUILD_NUMBER)"

                    docker build `
                        -f Dockerfile `
                        -t $imageTag `
                        --build-arg "VITE_GOOGLE_CLIENT_ID=$env:VITE_GOOGLE_CLIENT_ID" `
                        .

                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker image build failed"
                    }

                    Write-Host "Successfully built: $imageTag"
                '''
            }
        }

        stage('Push to Docker Hub') {
            when {
                expression {
                    return params.PUSH
                }
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

                        if ([string]::IsNullOrWhiteSpace($env:DOCKER_USER)) {
                            throw "Docker Hub username is empty"
                        }

                        if ([string]::IsNullOrWhiteSpace($env:DOCKER_PASS)) {
                            throw "Docker Hub token is empty"
                        }

                        Write-Host "Authenticating with Docker Hub..."

                        $env:DOCKER_PASS | docker login `
                            --username $env:DOCKER_USER `
                            --password-stdin 2>&1

                        $loginExitCode = $LASTEXITCODE

                        if ($loginExitCode -ne 0) {
                            throw "Docker Hub login failed with exit code $loginExitCode"
                        }

                        Write-Host "Docker Hub login successful"

                        $imageTag = "$($env:APP_IMAGE):$($env:BUILD_NUMBER)"

                        docker push $imageTag
                        if ($LASTEXITCODE -ne 0) {
                            throw "Docker image push failed"
                        }

                        Write-Host "Successfully pushed: $imageTag"

                        docker logout
                    '''
                }
            }
        }

        stage('Deploy') {
            when {
                expression {
                    return params.DEPLOY
                }
            }

            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    if (!(Test-Path "docker-compose.yml")) {
                        throw "docker-compose.yml not found"
                    }

                    if (!(Test-Path ".env")) {
                        throw ".env file not found"
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
            echo 'Pipeline failed. Check Console Output.'
        }

        always {
            powershell '''
                docker image ls --filter "reference=udaynaik07/capstone-2:*"
            '''

            cleanWs(
                deleteDirs: true,
                notFailBuild: true
            )
        }
    }
}
