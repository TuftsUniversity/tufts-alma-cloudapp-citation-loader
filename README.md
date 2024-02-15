# Tufts-Alma-CloudApp-Citation-Loader
Citation Loader by Excel. Create reading lists and citations by uploading an Excel file.

Author: Henry Steele, Library Technology Services, Tufts University

Note that the decision was made not to allow the process to updated citation statuses, because these are most often determined by configurations in Alma
## Input data
- course code
  - At Tufts University where this was created, course codes uniquely identify both a course and a section.  If you institution shares course codes for e.g. different sections, you may want to redevelop this to receive section ID
- MMS ID
    - of citation
    - this app is set up to create repository citations attached to existing bib records
## Defaults
Defaults are assumed for the creation of reading lists and citations except the fields you can specify in the spreadsheet.   

## Validation

### Course and reading list validation
- before creating a citation, this app does a course and reading list search and validates that:
  - the course exists
  - the reading list exists AND
  - there is exactly one reading list for that course
  - if there are none it creates one with defaults
  - if there is more than one, it errors with the message that reading list assignment is ambiguous because there is more than one reading list

### Citation validation
- because this process is only for repository citations, the application checks that the MMS is for a valid bib record.
-if not it records an error
- determines if a citation with that MMS ID is already on the reading list.  This is beacuse although reserves staff might have received a request to create a citation for this reading list via email etc, they may in the meantime add it themselves.  In this case it will not go into update or success , or miss, but rather the intermediate status of "Skipped"

## Use
- create an excel file with 3 columns:
  - course_code
  - mms_id


- pick file
- load
- wait for it to process
- at the end the processing log shows with
    - Number of processed entries
    - Number of successfully updated entries
    - Number of skipped entries
    - Number of error entries
- you can also download this log

https://developers.exlibrisgroup.com/appcenter/citation-loader/
