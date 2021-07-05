1. Log in to AWS EC2

2. Go to instances

3. Find the instance for `services.backend.iobio.io`

4. Do `Instance State > Stop instance`

5. Refresh

6. Do `Instance State > Force stop instance`

7. Refresh until stopped (may take at least a few minutes)

8. Do `Instance State > Start instance`

9. SSH into new instance using ubuntu@(IP address from AWS console) and `iobioServers.cer`

10. run `tmux`

11. cd into `iobio-backend-services/pheno/` 

12. Run `node index.js`
