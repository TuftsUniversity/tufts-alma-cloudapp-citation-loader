# Tufts-Alma-CloudApp-Citation-Loader
Citation Loader by Excel. Create reading lists and citations by uploading an Excel file.

Author: Henry Steele, Library Technology Services, Tufts University

Note that the decision was made not to allow the process to updated citation statuses, because these are most often determined by configurations in Alma
## Input data
- This citation loader is designed to be as flexible as possible with input, especially being able to accept input from the overlap analysis Lookup Title report
- It needs MMS and Course Code, but it can include a lot of other fields like barcode, reading list section, and course section if you want.   If no reading list section is provided it will enter citations under the "Resources" section.   Course section is necessary if your course codes by themselves are not unique
- here is the list of fields the citation loader can ingest
-   course_code or Course Code
  - required
- course_section or Course Section
  - required if course code is not unique
- mms_id or MMS ID
  - required
- citation_type or Citation Type or secondary_type
  - this is the secondardy type of the citation. The primary type for non articles is always "Book" per Leganto
- barcode
  - if the citation is physical and if you want it moved to the temporary reserves location defined in settings
- course code
  - At Tufts University where this was created, course codes uniquely identify both a course and a section.  If you institution shares course codes for e.g. different sections, you may want to redevelop this to receive section ID
- section_info
    - this is the reading list section, if desired
- item_policy or Item Policy
  - this is the temporary item policy you want physical citations to move to as part of the temporary move.
  - Leave blank if none are desired

## Settings
- the settings page lets you configure the temporary library and location to move the physical material to, and if you want these physical citations to complete once they are succcessfully moved.   You may not want them to complete if you haven't physically retreived the items yet, in which case you can keep track of them in your tasks list
## Defaults
Defaults are assumed for the creation of reading lists and citations except the fields you can specify in the spreadsheet.   


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
- export an Excel file with the above fields, e.g. from the Overlap analysis tool
- set settings

- pick file
- load
- wait for it to process
- at the end the processing log shows with
    - Number of processed entries
    - Number of successfully updated entries
    - Number of skipped entries (exists on reading list already)
    - Number of error entries
    - if all citations on each reading list were completed successfully, and all citations that were there before also have a status complete, then it will show the counts of the reading lists that were completed.  If you have physical citations not complete and there are physical citations on the reading list, then that particularly reading list won't complete 
- you can also download this log

https://developers.exlibrisgroup.com/appcenter/citation-loader/
