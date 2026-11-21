// Jenkins CI/CD for the Telco Churn app.
//
// Builds ONE application image (React SPA + Express API + embedded Python ML
// model), runs the test suites, and (on main) optionally pushes to Docker Hub
// and deploys via docker compose.
//
// Requirements on the Jenkins controller:
//   - A Docker-capable agent with the label 'docker' (docker CLI available).
//   - Credentials:
//       * dockerhub-cred  -> Username/Password (or token) for Docker Hub.
//   - Optional parameters PUSH (default true) and DEPLOY (default false).
//
// The Node test/build stages run inside throwaway node:20 containers so the
// agent needs no global Node install.

pipeline {
  agent { label 'docker' }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
  }

  environment {
    IMAGE_TAG  = "${env.BUILD_NUMBER ?: 'manual'}"
    DOCKERHUB_USER = 'udaynaik07'
    APP_IMAGE  = "${DOCKERHUB_USER}/capstone-2"
    NODE_IMAGE = 'node:20-bookworm-slim'
  }

  parameters {
    booleanParam(name: 'PUSH',   defaultValue: true,  description: 'Push the image to Docker Hub (only runs on the main branch).')
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Run `docker compose up -d` after building the image (only on main).')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'echo "Building ${APP_IMAGE}:${IMAGE_TAG}"'
      }
    }

    stage('Backend: install & test') {
      steps {
        sh '''
          docker run --rm \
            -v "$WORKSPACE/Website/backend":/app -w /app \
            "$NODE_IMAGE" sh -c "npm ci && npm test"
        '''
      }
    }

    stage('Frontend: install & build') {
      steps {
        sh '''
          docker run --rm \
            -v "$WORKSPACE/Website/frontend":/app -w /app \
            -e VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}" \
            "$NODE_IMAGE" sh -c "npm ci && npm run build"
        '''
      }
    }

    stage('Build Docker image') {
      steps {
        sh '''
          set -e
          docker build -f Dockerfile -t "$APP_IMAGE:$IMAGE_TAG" -t "$APP_IMAGE:latest" \
            --build-arg VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}" .
        '''
      }
    }

    stage('Push image') {
      when {
        allOf {
          expression { return params.PUSH }
          expression { return (env.BRANCH_NAME == 'main') }
        }
      }
      steps {
        script {
          docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-cred') {
            sh '''
              set -e
              docker push "$APP_IMAGE:$IMAGE_TAG"; docker push "$APP_IMAGE:latest"
            '''
          }
        }
      }
    }

    stage('Deploy (docker compose)') {
      when {
        allOf {
          expression { return params.DEPLOY }
          expression { return (env.BRANCH_NAME == 'main') }
        }
      }
      steps {
        sh '''
          set -e
          if [ ! -f .env ]; then
            echo "ERROR: .env not found on the agent (needed for JWT_SECRET etc.)." >&2
            exit 1
          fi
          IMAGE_TAG="$IMAGE_TAG" docker compose -f docker-compose.yml up -d --remove-orphans
          docker compose -f docker-compose.yml ps
        '''
      }
    }
  }

  post {
    success { echo 'Telco app pipeline succeeded.' }
    failure { echo 'Telco app pipeline failed.' }
    always {
      sh 'docker image ls | grep capstone-2 || true'
      cleanWs(deleteDirs: true, notFailBuild: true)
    }
  }
}