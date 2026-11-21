// Jenkins CI/CD for the Telco Churn MERN app.
//
// Builds the MERN images (telco-ml / telco-backend / telco-frontend), runs the
// test suites, and (on main) optionally pushes to Docker Hub and deploys via
// docker compose.
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
    IMAGE_TAG    = "${env.BUILD_NUMBER ?: 'manual'}"
    DOCKERHUB_USER = 'udaynaik07'
    ML_IMAGE     = "${DOCKERHUB_USER}/telco-ml"
    BE_IMAGE     = "${DOCKERHUB_USER}/telco-backend"
    FE_IMAGE     = "${DOCKERHUB_USER}/telco-frontend"
    NODE_IMAGE   = 'node:20-bookworm-slim'
  }

  parameters {
    booleanParam(name: 'PUSH',   defaultValue: true,  description: 'Push images to Docker Hub (only runs on the main branch).')
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Run `docker compose up -d` after building images (only on main).')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'echo "Building ${ML_IMAGE} / ${BE_IMAGE} / ${FE_IMAGE} : ${IMAGE_TAG}"'
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

    stage('Build Docker images') {
      steps {
        sh '''
          set -e
          docker build -f ML Model/services/ml/Dockerfile -t "$ML_IMAGE:$IMAGE_TAG" -t "$ML_IMAGE:latest" "ML Model"
          docker build -f Website/backend/Dockerfile  -t "$BE_IMAGE:$IMAGE_TAG" -t "$BE_IMAGE:latest" Website/backend
          docker build -f Website/frontend/Dockerfile -t "$FE_IMAGE:$IMAGE_TAG" -t "$FE_IMAGE:latest" \
            --build-arg VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}" Website/frontend
        '''
      }
    }

    stage('Push images') {
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
              docker push "$ML_IMAGE:$IMAGE_TAG"; docker push "$ML_IMAGE:latest"
              docker push "$BE_IMAGE:$IMAGE_TAG"; docker push "$BE_IMAGE:latest"
              docker push "$FE_IMAGE:$IMAGE_TAG"; docker push "$FE_IMAGE:latest"
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
    success { echo '✅ Telco MERN pipeline succeeded.' }
    failure { echo '❌ Telco MERN pipeline failed.' }
    always {
      sh 'docker image ls | grep -E "telco-(ml|backend|frontend)" || true'
      cleanWs(deleteDirs: true, notFailBuild: true)
    }
  }
}