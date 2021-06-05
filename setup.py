from setuptools import find_packages, setup

setup(
      name='newvelles_web',
      version='0.0.2',
      description='Flask-based webapp for newvelles',
      url='https://github.com/glhuilli/newvelles_web',
      author="Gaston L'Huillier",
      author_email='glhuilli@gmail.com',
      license='MIT License',
      packages=find_packages(),
      package_data={
            '': ['LICENSE']
      },
      zip_safe=False,
      install_requires=[x.strip() for x in open("requirements.txt").readlines()]
)
