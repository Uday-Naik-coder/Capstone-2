import pandas as pd
import os

def load_data(file_path: str) -> pd.DataFrame:
    """
    Loads CSV data into a pandas DataFrame.

    Args:
        file_path (str): Path to the CSV file.

    Returns:
        pd.DataFrame: Loaded dataset.
    """
    # Fail early with a clear error if the expected dataset path does not exist
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Load the raw CSV dataset into a DataFrame for validation and preprocessing
    return pd.read_csv(file_path)