# Blood vessel annotation tool
Annotate blood vessels using a web browser.

![Annotation GUI](gui.png)

This is a *standalone version* of the annotation toolbox that allows you to load images, complete the task, and download the results to your computer. An alternative version of this annotation toolbox (not available here) runs on a web server and allows an arbitrary number of annotators to simultaneously complete these tasks directly in the cloud where tasks are automatically and centrally served and stored.

## Prerequisites
* Firefox or Chrome.

## Installation
* Download and extract files.
* Unzip `test-data.zip` if needed.

## Usage
* Double click `annotation.html` and follow the instructions to complete the task.
* When finished, click on `Submit` to download the results.

## Online demonstration
[Demo](https://codepen.io/leonardomt/full/jOEvPvY)

## Output
The results are downloaded to your computer in JSON format where each line corresponds to an image. The following fields are saved:
* `folder`: name of the selected folder.
* `name`: name of the image completed within folder.
* `area`: area calculated inside the polygon drawn.
* `vertices`: `x` and `y` coordinates of each point in the drawing.
* `polygon`: `x` and `y` coordinates of each point of the concavehall around the vertices.
* `height`: height of the image presented to the user
* `assignmentId`/`hitId`/`workerId`: variables used in the server version of the toolbox to identify assignment, task, and annotator, respectively.
* `start`: when task started.
* `end`: when task ended.