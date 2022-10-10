f = open("camera_trajectory.txt", "r")
contents = f.read()
#print(contents)

str = ''

for line in contents.split('\n'):
    #print(line)

    str = str + '['

    for token in line.split(' '):
        str = str + token
        str = str + ', '

    str = str[:len(str) - 2]
    str = str + '],\n'

print('written contents to ./camera_trajectory_output.txt')

f = open("camera_trajectory_output.txt", "w")
f.write(str)