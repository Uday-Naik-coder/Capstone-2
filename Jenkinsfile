
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        APP_IMAGE  = 'udaynaik07/capstone-2'
        NODE_IMAGE = 'node:20-bookworm-slim'
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
                    $latestTag = "$($env:APP_IMAGE):latest"

                    docker build `
                        -f Dockerfile `
                        -t $imageTag `
                        -t $latestTag `
                        --build-arg "VITE_GOOGLE_CLIENT_ID=$env:VITE_GOOGLE_CLIENT_ID" `
                        .

                    if ($LASTEXITCODE -ne 0) {
                        throw "Docker image build failed"
                    }

                    Write-Host "Successfully built: $imageTag and $latestTag"
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
