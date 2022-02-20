import ephem
import datetime
import math

months = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]

# Changing the float prediction from ephem to an actual phase
def phases(x):
    if 7.5 < x or x < 0.5:
        return "Stable"
    if 0.5 < x < 1.5:
        return "Stable"
    if 1.5 < x < 2.5:
        return "Unstable"
    if 2.5 < x < 3.5:
        return "Risky"
    if 3.5 < x < 4.5:
        return "Wild"
    if 4.5 < x < 5.5:
        return "Risky"
    if 5.5 < x < 6.5:
        return "Unstable"
    if 6.5 < x < 7.5:
        return "Stable"
    else:
        print("Whoops!", x)

#For the right amount of days
days_in_months = {
    1: 31,
    2: 28,
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31
}

def phase_from_time(month, day):
    # Gets the steak phase from the time which is used for the moon phase
    date = datetime.datetime(2022, month, day, 5, 30)
    gatech = ephem.Observer()
    gatech.lon, gatech.lat = "39.655217", "-105.109236"
    gatech.date = date
    moon = ephem.Moon()
    moon.compute(gatech)
    phase = phases((moon.elong.norm + 0.0) / math.pi * 4)
    return phase

def generate_dict(months):
    # Generates the dictionary to print
    months_list = []
    for i in months:
        phase_dict = {}
        for j in range(1, days_in_months[i]+1):
            phase_dict["%s/%s/22"%(i, j)] = phase_from_time(i, j)
        months_list.append(phase_dict)
    return months_list

if __name__ == "__main__":
    # Gets an input from the user and generates the steak phases for those months
    month_list = list(map(int, input("Enter months separated by commas(Example for Jan-Feb: 1,2]): ").strip().split(",")))
    dict_list = generate_dict(month_list)
    print("Steak Phase Predictions:")
    for i in range(len(month_list)):
        print(months[month_list[i]-1] + ":", dict_list[i])


