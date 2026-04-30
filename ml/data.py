import numpy as np
import pandas as pd

def generate_student_data(n_samples=10000, seed=42):
    np.random.seed(seed)
    data = []
    
    # Define archetypes
    archetypes = ["strong", "improving", "declining", "struggler", "resilient"]
    weights = [0.15, 0.20, 0.15, 0.35, 0.15]

    for _ in range(n_samples):
        # Pick an archetype
        archetype = np.random.choice(archetypes, p=weights)
        
        # Generate past grades based on archetype
        if archetype == "strong":
            past_grades = np.random.normal(85, 5, 10)  # stable high
        elif archetype == "improving":
            base = np.linspace(60, 85, 10)  # upward trend
            past_grades = base + np.random.normal(0, 5, 10)
        elif archetype == "declining":
            base = np.linspace(90, 70, 10)  # downward trend
            past_grades = base + np.random.normal(0, 5, 10)
        elif archetype == "struggler":
            past_grades = np.random.normal(75, 10, 10)  # mid but noisy
        elif archetype == "resilient":
            base = np.linspace(55, 80, 10)  # improving despite low start
            past_grades = base + np.random.normal(0, 7, 10)

        past_grades = np.clip(past_grades, 0, 100)
        avg_past = np.mean(past_grades)
        
        # Generate difficulty (1 easy → 10 hard)
        difficulty = np.random.randint(1, 11)
        
        # Compute current grade depending on archetype
        if archetype == "strong":
            current = avg_past - (difficulty * 1.5) + np.random.normal(0, 5)
        elif archetype == "improving":
            current = avg_past + 5 - (difficulty * 2) + np.random.normal(0, 5)
        elif archetype == "declining":
            current = avg_past - 5 - (difficulty * 2.5) + np.random.normal(0, 6)
        elif archetype == "struggler":
            current = avg_past - (difficulty * 4) + np.random.normal(0, 8)
        elif archetype == "resilient":
            current = avg_past + (10 - difficulty) * 0.5 + np.random.normal(0, 6)
        
        current = np.clip(current, 0, 100)
        
        # Store in dataset
        data.append({
            "past_grades": past_grades.tolist(),
            "difficulty": difficulty,
            "current_grade": current,
            "archetype": archetype
        })
    
    return pd.DataFrame(data)

def fetch_raw(limit: int = 0, seed: int = 42):
    """Fetch raw synthetic student records (optionally limited)."""
    n = limit if limit and limit > 0 else 1000
    return generate_student_data(n_samples=n, seed=seed)


def build_features(df: pd.DataFrame,
                   extended: bool = False,
                   scale_grades: bool = False,
                   super_minimal: bool = False,
                   keep_g1_g2: bool = True,
                   add_difficulty: bool = True,
                   difficulty_group: str | None = None,
                   dfw_threshold_percent: float = 50.0,
                   ten_class: bool = False,
                   bucket_5: bool = False):
    """Transform raw dataframe into feature matrix X and target y.

    Parameters mirror those expected by model.py (some are placeholders for future real dataset integration).
    """
    # Past grades -> columns g0..g9
    grade_cols = [f'g{i}' for i in range(10)]
    grades_expanded = df.past_grades.apply(lambda lst: pd.Series(lst, index=grade_cols))
    feat_df = grades_expanded
    if add_difficulty:
        feat_df = pd.concat([feat_df, df['difficulty']], axis=1)
        feat_df['difficulty'] = (feat_df['difficulty'].astype(float) - 1) / 9.0

    if scale_grades:
        feat_df[grade_cols] = feat_df[grade_cols] / 100.0

    y = df['current_grade']
    if bucket_5 or ten_class:
        if bucket_5:
            bins = [0,60,70,80,90,101]
        else:
            bins = list(range(0, 101, 10))
            if bins[-1] != 100:
                bins.append(101)
        y = pd.cut(y, bins=bins, labels=False, include_lowest=True)

    return feat_df, y

# If run standalone, show a quick sample
if __name__ == '__main__':
    demo = fetch_raw(20)
    X_demo, y_demo = build_features(demo, scale_grades=True, ten_class=True)
    print(X_demo.head())
    print(y_demo.head())
