from sklearn.metrics import classification_report, confusion_matrix

def evaluate_model(model, X_test, y_test):
    """
    Evaluates an XGBoost model on test data.

    Args:
        model: Trained model.
        X_test: Test features.
        y_test: Test labels.
    """
    # Generate binary class predictions (0 = retained, 1 = churned) on the test set
    preds = model.predict(X_test)

    # Output precision, recall, F1-score, and support per class
    print("Classification Report:\n", classification_report(y_test, preds))
    # Output TP/FP/TN/FN counts to inspect false negatives on churned customers
    print("Confusion Matrix:\n", confusion_matrix(y_test, preds))
